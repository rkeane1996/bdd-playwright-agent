import { Injectable, BadRequestException } from '@nestjs/common';
import { AgentService, ScenarioResult } from '../agent/agent.service';
import { parseFeature } from './gherkin';

@Injectable()
export class TestRunnerService {
  constructor(private readonly agent: AgentService) {}

  async execute(featureText: string) {
    let parsed;
    try {
      parsed = parseFeature(featureText);
    } catch (e: any) {
      throw new BadRequestException(`Invalid Gherkin: ${e.message}`);
    }
    if (parsed.scenarios.length === 0) {
      throw new BadRequestException('No scenarios found in feature file');
    }
    
    const results: ScenarioResult[] = [];
    for (const scenario of parsed.scenarios) {
      results.push(await this.agent.runScenario(parsed.feature, scenario));
    }

    const passed = results.filter((r) => r.status === 'passed').length;
    return {
      feature: parsed.feature,
      total: results.length,
      passed,
      failed: results.length - passed,
      results,
    };
  }
}
