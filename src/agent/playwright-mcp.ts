import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** One Playwright MCP server (= one isolated browser) per scenario. */
export class PlaywrightMcpSession {
  private client = new Client({ name: 'bdd-agent', version: '0.1.0' });

  async start() {
    const args = ['-y', '@playwright/mcp@latest', '--isolated'];
    if (process.env.PLAYWRIGHT_HEADLESS !== 'false') args.push('--headless');

    await this.client.connect(
      new StdioClientTransport({ command: 'npx', args }),
    );
  }

  async listTools() {
    return (await this.client.listTools()).tools;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.client.callTool({ name, arguments: args });
  }

  async close() {
    await this.client.close().catch(() => undefined);
  }
}
