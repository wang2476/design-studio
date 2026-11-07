// POST /__studio/swiftview/render { contributor, prototype, path }: re-renders the Lab file a Swift view
// came from (its `source`) and re-imports it. Dev only. Only the prototype's owner may run it, since it
// rewrites files in their prototype. ponytail: owner check only; let admins too if a team shares renders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModuleServer } from '#studio/module';
import { checkSource, renderInto } from './node/renders.js';

const PROTOS = fileURLToPath(new URL('../../prototypes/', import.meta.url));
const KEY = /^[\w-]{1,80}$/;
const VIEW = /^[\w./-]+\.swiftview$/;

export default {
  render: async ({ me, body }) => {
    const { contributor, prototype, path: file } = (body ?? {}) as Record<string, unknown>;
    if (typeof contributor !== 'string' || !KEY.test(contributor) || typeof prototype !== 'string' || !KEY.test(prototype)
      || typeof file !== 'string' || !VIEW.test(file) || file.split('/').includes('..'))
      return { status: 400, body: { error: 'Invalid render request.' } };
    if (me !== contributor) return { status: 403, body: { error: 'Only the prototype’s owner can re-render it.' } };
    const dir = path.join(PROTOS, contributor, prototype);
    const view = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as { source?: unknown };
    if (!view.source) return { status: 422, body: { error: 'This Swift view has no source; render it once with pnpm swift.' } };
    const source = checkSource(view.source as { lab: unknown; name: unknown });
    const { log, written } = await renderInto(path.join(dir, path.dirname(file)), source);
    return { body: { log, count: written.length } };
  },
} satisfies ModuleServer;
