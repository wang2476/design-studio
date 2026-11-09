// End-to-end check of the running MCP: node mcp/smoke.ts [url]
// Creates a throwaway prototype, exercises every tool except render_swift, then removes it.
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/mcp';
const client = new Client({ name: 'smoke', version: '1' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

async function call(name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  const text = r.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const name = `mcp-smoke-${Date.now()}`;
const prototype = `aaron/${name}`;
const dir = path.resolve(import.meta.dirname, '../src/prototypes', prototype);
try {
  const tools = (await client.listTools()).tools.map(t => t.name);
  assert.ok(tools.includes('render_swift') && tools.includes('get_round'), `tools: ${tools}`);

  const created = await call('create_prototype', { contributor: 'aaron', name, title: 'MCP smoke' });
  assert.match(created.url, /\/prototypes\/\w+$/);

  const a = await call('write_file', { prototype, path: 'a.md', content: '# Option A\n' });
  await call('write_file', { prototype, path: 'b.md', content: '# Option B\n' });
  assert.match(await call('read_file', { prototype, path: 'a.md' }), /# Option A\n$/);
  assert.match(a.url, /\/artifacts\/\w+$/, 'written file gets its own artifact link');

  const round = await call('create_round', {
    prototype,
    name: 'pick',
    question: 'A or B?',
    options: [{ path: 'a.md', label: 'A' }],
  });
  assert.equal(round.round.options.length, 1);
  await call('add_round_option', { prototype, round: 'pick', path: 'b.md', label: 'B' });
  await call('set_option_status', { prototype, round: 'pick', n: 1, status: 'superseded' });
  const got = await call('get_round', { prototype, round: 'pick' });
  assert.deepEqual(
    got.round.options.map((o: { n: number; status: string }) => [o.n, o.status]),
    [
      [1, 'superseded'],
      [2, 'open'],
    ],
  );
  assert.equal(got.round.decision, null);
  assert.ok((await call('list_rounds', { prototype })).some((r: { round: string }) => r.round === 'pick.round'));

  // Escapes are refused.
  await assert.rejects(call('write_file', { prototype, path: '../../escape.md', content: 'x' }), /inside/);
  await assert.rejects(call('read_file', { prototype: '../x', path: 'a.md' }), /contributor\/name/);

  await call('write_file', {
    prototype,
    path: 'clip.videonotes',
    content: JSON.stringify({ video: 'clip.mp4', summary: '', notes: [] }),
  });
  await call('add_note', { prototype, path: 'clip.videonotes', t: 2.5, text: 'Toast lands late' });
  const notes = await call('get_notes', { prototype, path: 'clip.videonotes' });
  assert.equal(notes.notes[0].author, 'claude');
  assert.equal(notes.notes[0].t, 2.5);

  assert.ok((await call('list_prototypes')).some((p: { prototype: string }) => p.prototype === prototype));
  console.log(`smoke: ok (${tools.length} tools)`);
} finally {
  await rm(dir, { recursive: true, force: true });
  await client.close();
}
