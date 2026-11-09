// Design Studio MCP over Streamable HTTP, so Claude on any machine writes into one shared studio.
//   pnpm mcp                       → http://127.0.0.1:5174/mcp
//   MCP_HOST / MCP_PORT            → where it listens
//   STUDIO_PUBLIC_URL              → base of the links it returns (e.g. the Tailscale URL)
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as studio from './studio.ts';

const prototype = z.string().describe('"contributor/name", e.g. "aaron/layer-swift-spike"');
const ok = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const fail = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: String((error as Error)?.message ?? error) }],
});
const safe =
  <A>(fn: (args: A) => Promise<unknown>) =>
  async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (error) {
      console.error('[studio-mcp]', error);
      return fail(error);
    }
  };

function build(): McpServer {
  const s = new McpServer(
    { name: 'design-studio', version: '1.0.0' },
    {
      instructions:
        'Design Studio is where design work is shown to Aaron. Put each visual change in a prototype ' +
        '(write_file or render_swift), put alternatives in a round so he can compare and pick, give him the returned ' +
        'url, then read his decision with get_round. Never decide a round yourself.',
    },
  );

  s.registerTool(
    'list_prototypes',
    { description: 'Every prototype with its files and studio link.' },
    safe(async () => studio.listPrototypes()),
  );

  s.registerTool(
    'create_prototype',
    {
      description: 'Create an empty prototype folder for a contributor.',
      inputSchema: { contributor: z.string(), name: z.string().regex(/^[\w-]+$/), title: z.string() },
    },
    safe(async ({ contributor, name, title }) => studio.createPrototype(contributor, name, title)),
  );

  s.registerTool(
    'write_file',
    {
      description:
        'Create or replace a file in a prototype (an HTML/TSX/markdown artifact, for example). The open ' +
        'studio page updates live, like editing an artifact in place. Returns its studio link.',
      inputSchema: { prototype, path: z.string(), content: z.string() },
    },
    safe(async a => studio.writeArtifact(a.prototype, a.path, a.content)),
  );

  s.registerTool(
    'read_file',
    {
      description: 'Read a text file from a prototype.',
      inputSchema: { prototype, path: z.string() },
    },
    safe(async a => studio.readArtifact(a.prototype, a.path)),
  );

  s.registerTool(
    'render_swift',
    {
      description:
        'Render every #Preview in a Layer DesignLab Swift file on the simulator and import the drafts ' +
        '(<name>_1, _2, …) into the prototype. Slow: 30 s warm, minutes cold.',
      inputSchema: { prototype, lab: z.string().describe('e.g. App/DesignLab/ToastCardLab.swift'), name: z.string() },
    },
    safe(async a => studio.renderSwift(a.prototype, a.lab, a.name)),
  );

  s.registerTool(
    'create_round',
    {
      description: 'Start a decision round: options shown side by side for Aaron to pick from.',
      inputSchema: {
        prototype,
        name: z.string(),
        question: z.string(),
        options: z.array(z.object({ path: z.string(), label: z.string().optional() })).optional(),
      },
    },
    safe(async a => studio.createRound(a.prototype, a.name, a.question, a.options)),
  );

  s.registerTool(
    'add_round_option',
    {
      description: 'Add a file in the prototype as the next numbered option of a round.',
      inputSchema: { prototype, round: z.string(), path: z.string(), label: z.string().optional() },
    },
    safe(async a => studio.addRoundOption(a.prototype, a.round, a.path, a.label)),
  );

  s.registerTool(
    'set_option_status',
    {
      description:
        'Mark an option open, rejected or superseded (for example when a newer version replaces it). ' +
        'Picking belongs to Aaron.',
      inputSchema: {
        prototype,
        round: z.string(),
        n: z.number().int(),
        status: z.enum(['open', 'rejected', 'superseded']),
      },
    },
    safe(async a => studio.setOptionStatus(a.prototype, a.round, a.n, a.status)),
  );

  s.registerTool(
    'get_round',
    {
      description: "A round's options and Aaron's decision (pick, why, checks).",
      inputSchema: { prototype, round: z.string() },
    },
    safe(async a => studio.getRound(a.prototype, a.round)),
  );

  s.registerTool(
    'list_rounds',
    {
      description: 'Rounds with whether each is decided, for one prototype or all.',
      inputSchema: { prototype: prototype.optional() },
    },
    safe(async a => studio.listRounds(a.prototype)),
  );

  s.registerTool(
    'get_notes',
    {
      description: "A .videonotes file's notes, in clip order (Aaron's and Claude's).",
      inputSchema: { prototype, path: z.string() },
    },
    safe(async a => studio.getNotes(a.prototype, a.path)),
  );

  s.registerTool(
    'add_note',
    {
      description: 'Add a Claude note to a .videonotes file, at t seconds or for the whole clip (t null).',
      inputSchema: { prototype, path: z.string(), t: z.number().nullable(), text: z.string() },
    },
    safe(async a => studio.addNote(a.prototype, a.path, a.t, a.text)),
  );

  return s;
}

const host = process.env.MCP_HOST ?? '127.0.0.1';
const port = Number(process.env.MCP_PORT ?? 5174);

createServer(async (req, res) => {
  if (!req.url?.startsWith('/mcp')) {
    res.writeHead(404).end();
    return;
  }
  // Stateless: a fresh server per request, so nothing is held between calls.
  const server = build();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('[studio-mcp] request failed', error);
    if (!res.headersSent) res.writeHead(500).end();
  }
}).listen(port, host, () => console.log(`design-studio MCP on http://${host}:${port}/mcp → links ${studio.publicUrl}`));

process.on('unhandledRejection', e => console.error('[studio-mcp] unhandled rejection', e));
