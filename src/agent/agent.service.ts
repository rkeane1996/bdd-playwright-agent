import { Injectable } from '@nestjs/common';
import { GoogleGenAI, Content, Part, FunctionDeclaration } from '@google/genai';
import { PlaywrightMcpSession } from './playwright-mcp';
import { Scenario } from '../test-runner/gherkin';

export interface StepResult {
  step: string;
  status: 'passed' | 'failed' | 'skipped';
  details?: string;
}

export interface ScenarioResult {
  scenario: string;
  status: 'passed' | 'failed' | 'error';
  summary: string;
  steps: StepResult[];
  turns: number;
}

const REPORT_TOOL: FunctionDeclaration = {
  name: 'report_result',
  description:
    'Call exactly once when the scenario is finished (or a step has failed) to report the outcome.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['passed', 'failed'] },
      summary: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step: { type: 'string' },
            status: { type: 'string', enum: ['passed', 'failed', 'skipped'] },
            details: { type: 'string' },
          },
          required: ['step', 'status'],
        },
      },
    },
    required: ['status', 'summary', 'steps'],
  },
};

const SYSTEM_PROMPT = `You are an automated QA engineer executing a Gherkin scenario in a real browser using the Playwright tools.

Rules:
- Execute the steps in order. Interpret "Given" as setup/navigation, "When" as actions, and "Then" as assertions.
- For every "Then" step, VERIFY the expectation against the actual page state (use a snapshot) before marking it passed. Never assume.
- If an assertion is not met, or an element can't be found after a reasonable retry, mark that step failed, mark remaining steps skipped, and stop.
- Do not invent steps and do not do anything beyond what the scenario says.
- When finished, call report_result exactly once with the status of every step.`;

@Injectable()
export class AgentService {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  private model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  private maxTurns = Number(process.env.MAX_TURNS ?? 40);

  async runScenario(
    featureName: string,
    scenario: Scenario,
  ): Promise<ScenarioResult> {
    const session = new PlaywrightMcpSession();
    try {
      await session.start();
      const mcpTools = await session.listTools();

      const functionDeclarations: FunctionDeclaration[] = [
        ...mcpTools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          parametersJsonSchema: this.cleanSchema(t.inputSchema),
        })),
        REPORT_TOOL,
      ];

      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              text:
                `Feature: ${featureName}\nScenario: ${scenario.name}\n\nSteps:\n` +
                scenario.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
            },
          ],
        },
      ];

      for (let turn = 1; turn <= this.maxTurns; turn++) {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations }],
          },
        });

        const modelContent = res.candidates?.[0]?.content;
        if (!modelContent) break;

        contents.push(modelContent);

        const calls = res.functionCalls ?? [];
        if (calls.length === 0) break;

        const responseParts: Part[] = [];
        const imageParts: Part[] = [];
        let report: any;

        for (const call of calls) {
          const name = call.name!;
          if (name === 'report_result') {
            report = call.args;
            responseParts.push({
              functionResponse: { name, id: call.id, response: { output: 'Recorded.' } },
            });
            continue;
          }
          try {
            const out: any = await session.callTool(
              name,
              (call.args ?? {}) as Record<string, unknown>,
            );
            const { text, images } = this.flatten(out.content);
            responseParts.push({
              functionResponse: {
                name,
                id: call.id,
                response: out.isError ? { error: text } : { output: text },
              },
            });
            imageParts.push(...images);
          } catch (e: any) {
            responseParts.push({
              functionResponse: { name, id: call.id, response: { error: e.message } },
            });
          }
        }

        // functionResponse parts first, then any screenshots
        contents.push({ role: 'user', parts: [...responseParts, ...imageParts] });

        if (report) {
          return {
            scenario: scenario.name,
            status: report.status,
            summary: report.summary,
            steps: report.steps,
            turns: turn,
          };
        }
      }

      return {
        scenario: scenario.name,
        status: 'error',
        summary: 'Agent ended without reporting a result (turn limit or early stop).',
        steps: scenario.steps.map((s) => ({ step: s, status: 'skipped' as const })),
        turns: this.maxTurns,
      };
    } catch (e: any) {
      return {
        scenario: scenario.name,
        status: 'error',
        summary: e.message,
        steps: [],
        turns: 0,
      };
    } finally {
      await session.close();
    }
  }

  /** MCP content blocks -> one text string + inline image parts. */
  private flatten(content: any[] = []): { text: string; images: Part[] } {
    const texts: string[] = [];
    const images: Part[] = [];
    for (const c of content) {
      if (c.type === 'text') texts.push(c.text);
      else if (c.type === 'image')
        images.push({ inlineData: { mimeType: c.mimeType, data: c.data } });
    }
    return { text: texts.join('\n') || '(no output)', images };
  }

  /** Gemini rejects a few JSON-Schema keywords that MCP/zod schemas include. */
  private cleanSchema(schema: any): any {
    if (Array.isArray(schema)) return schema.map((s) => this.cleanSchema(s));
    if (schema && typeof schema === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(schema)) {
        if (k === '$schema' || k === 'additionalProperties') continue;
        out[k] = this.cleanSchema(v);
      }
      return out;
    }
    return schema;
  }
}
