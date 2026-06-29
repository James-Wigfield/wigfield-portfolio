/* Quick local smoke test: connect to the running `wrangler dev` MCP server over
   SSE, list its tools, and call save_sprite with a tiny 2x2 sprite. Run with:
     node mcp-pixel-gif/test-client.mjs
   (Delete this file whenever — it's just for verifying the local server works.) */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Defaults to the local dev server; pass a URL to test the deployed Worker:
//   node mcp-pixel-gif/test-client.mjs https://pixel-gif-mcp.<you>.workers.dev/sse
const url = new URL(process.argv[2] || 'http://127.0.0.1:8787/sse');
const client = new Client({ name: 'local-test', version: '1.0.0' });

try {
  await client.connect(new SSEClientTransport(url));

  const { tools } = await client.listTools();
  console.log('Connected. Tools:', tools.map((t) => t.name).join(', ') || '(none)');

  const result = await client.callTool({
    name: 'save_sprite',
    arguments: {
      name: 'Test dot',
      sprite: {
        width: 2,
        height: 2,
        delayMs: 200,
        palette: ['#000000', '#15a292'],
        transparentIndex: 0,
        frames: [[0, 1, 1, 0]],
      },
    },
  });

  console.log('save_sprite result:', JSON.stringify(result.content, null, 2));
  await client.close();
  process.exit(0);
} catch (e) {
  console.error('FAILED:', e?.message || e);
  process.exit(1);
}
