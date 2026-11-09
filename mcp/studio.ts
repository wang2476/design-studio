// File operations behind the Design Studio MCP. Everything lands in src/prototypes, where the
// running dev server picks it up live, the same way an artifact updates in place.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  addOption,
  parseRound,
  serialize,
  setStatus,
  STATUSES,
  summary,
  type Round,
  type Status,
} from '../src/modules/rounds/round.ts';
import { newNoteId, parseVideoNotes, sortNotes, withNotes } from '../src/modules/videonotes/videoNotes.ts';
// @ts-expect-error plain JS module
import { renderInto } from '../src/modules/swiftview/node/renders.js';

const run = promisify(execFile);
export const repo = path.resolve(import.meta.dirname, '..');
const prototypes = path.join(repo, 'src/prototypes');
export const publicUrl = (process.env.STUDIO_PUBLIC_URL ?? 'http://localhost:5173').replace(/\/$/, '');

const PROTO = /^[\w-]+\/[\w-]+$/;
export function protoDir(prototype: string): string {
  if (!PROTO.test(prototype)) throw new Error(`prototype must look like "contributor/name", got "${prototype}"`);
  return path.join(prototypes, prototype);
}

/** A path inside the prototype folder; refuses anything that climbs out of it. */
export function inProto(prototype: string, rel: string): string {
  const dir = protoDir(prototype);
  const full = path.resolve(dir, rel);
  if (!full.startsWith(dir + path.sep) || rel.includes('\0')) throw new Error(`path must stay inside ${prototype}`);
  return full;
}

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

async function identify(prototype: string) {
  await run(process.execPath, ['src/platform/node/cli/studio.js', 'identify', protoDir(prototype), '--yes'], {
    cwd: repo,
  });
}

/** The studio ID of a file, wherever its format keeps it. */
async function fileId(full: string): Promise<string | null> {
  if (!existsSync(full)) return null;
  const text = await readFile(full, 'utf8').catch(() => '');
  // JSON "studioId": "…", markdown front matter studioId: …, or a TSX/HTML @studio-id comment.
  return text.match(/"?studioId"?:\s*"?(\w+)/)?.[1] ?? text.match(/@studio-id (\w+)/)?.[1] ?? null;
}

export async function urlFor(prototype: string, rel?: string): Promise<string> {
  const id = (await readJson(path.join(protoDir(prototype), 'meta.json'))).studioId;
  const artifact = rel ? await fileId(inProto(prototype, rel)) : null;
  return `${publicUrl}/prototypes/${id}${artifact ? `/artifacts/${artifact}` : ''}`;
}

export async function listPrototypes() {
  const out = [];
  for (const contributor of await readdir(prototypes)) {
    const cdir = path.join(prototypes, contributor);
    for (const name of await readdir(cdir).catch(() => [])) {
      const meta = path.join(cdir, name, 'meta.json');
      if (!existsSync(meta)) continue;
      const prototype = `${contributor}/${name}`;
      const files = (await readdir(path.join(cdir, name))).filter(f => f !== 'meta.json');
      out.push({ prototype, title: (await readJson(meta)).title, url: await urlFor(prototype), files });
    }
  }
  return out;
}

export async function createPrototype(contributor: string, name: string, title: string) {
  const prototype = `${contributor}/${name}`;
  const dir = protoDir(prototype);
  if (existsSync(dir)) throw new Error(`${prototype} already exists`);
  const owner = await readJson(path.join(repo, 'contributors', `${contributor}.json`)).catch(() => {
    throw new Error(`no contributor "${contributor}" in contributors/`);
  });
  const config = await readJson(path.join(repo, 'studio.config.json'));
  await mkdir(dir, { recursive: true });
  const meta = {
    formatVersion: 1,
    title,
    created: new Date().toISOString().slice(0, 10),
    ownerContributorId: owner.studioId,
    systemId: config.defaultSystem,
  };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await writeFile(
    path.join(dir, 'prototype.tsx'),
    "import { emptyView } from '@module/view';\n\nexport default emptyView;\n",
  );
  await identify(prototype);
  return { prototype, url: await urlFor(prototype) };
}

export async function writeArtifact(prototype: string, rel: string, content: string) {
  const full = inProto(prototype, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
  await identify(prototype);
  return { path: rel, url: await urlFor(prototype, rel) };
}

export const readArtifact = (prototype: string, rel: string) => readFile(inProto(prototype, rel), 'utf8');

// ── rounds ──────────────────────────────────────────────────────────────
const roundFile = (name: string) => (name.endsWith('.round') ? name : `${name}.round`);

async function loadRound(prototype: string, name: string) {
  const source = await readFile(inProto(prototype, roundFile(name)), 'utf8');
  const round = parseRound(source);
  if ('error' in round) throw new Error(`${roundFile(name)}: ${round.error}`);
  return { source, round };
}

async function saveRound(prototype: string, name: string, source: string, round: Round) {
  await writeFile(inProto(prototype, roundFile(name)), serialize(source, round));
  return { round, url: await urlFor(prototype, roundFile(name)) };
}

export async function createRound(
  prototype: string,
  name: string,
  question: string,
  options: { path: string; label?: string }[] = [],
) {
  const full = inProto(prototype, roundFile(name));
  if (existsSync(full)) throw new Error(`${roundFile(name)} already exists; add options to it instead`);
  let round: Round = { question, options: [], decision: null };
  for (const o of options) {
    inProto(prototype, o.path);
    round = addOption(round, o.path, o.label);
  }
  await writeFile(full, serialize('{}', round)); // no previous file, so nothing to carry over
  await identify(prototype);
  return { round, url: await urlFor(prototype, roundFile(name)) };
}

export async function addRoundOption(prototype: string, name: string, optionPath: string, label = '') {
  inProto(prototype, optionPath);
  const { source, round } = await loadRound(prototype, name);
  return saveRound(prototype, name, source, addOption(round, optionPath, label));
}

export async function setOptionStatus(prototype: string, name: string, n: number, status: Status) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const { source, round } = await loadRound(prototype, name);
  return saveRound(prototype, name, source, setStatus(round, n, status));
}

export async function getRound(prototype: string, name: string) {
  const { round } = await loadRound(prototype, name);
  return {
    round,
    summary: summary(roundFile(name).replace(/\.round$/, ''), round),
    url: await urlFor(prototype, roundFile(name)),
  };
}

export async function listRounds(prototype?: string) {
  const protos = prototype ? [prototype] : (await listPrototypes()).map(p => p.prototype);
  const out = [];
  for (const p of protos) {
    for (const f of (await readdir(protoDir(p))).filter(f => f.endsWith('.round'))) {
      const { round } = await loadRound(p, f);
      out.push({
        prototype: p,
        round: f,
        question: round.question,
        decided: !!round.decision,
        open: round.options.filter(o => o.status === 'open').length,
      });
    }
  }
  return out;
}

// ── video notes ─────────────────────────────────────────────────────────
async function loadNotes(prototype: string, rel: string) {
  const source = await readFile(inProto(prototype, rel), 'utf8');
  const notes = parseVideoNotes(source);
  if ('error' in notes) throw new Error(`${rel}: ${notes.error}`);
  return { source, notes };
}

export async function getNotes(prototype: string, rel: string) {
  const { notes } = await loadNotes(prototype, rel);
  return { ...notes, notes: sortNotes(notes.notes), url: await urlFor(prototype, rel) };
}

export async function addNote(prototype: string, rel: string, t: number | null, text: string) {
  const { source, notes } = await loadNotes(prototype, rel);
  const note = { id: newNoteId(), t, text, author: 'claude' as const, createdAt: new Date().toISOString() };
  await writeFile(
    inProto(prototype, rel),
    withNotes(source, { summary: notes.summary, notes: [...notes.notes, note] }),
  );
  return { note, url: await urlFor(prototype, rel) };
}

// ── Swift renders ───────────────────────────────────────────────────────
export async function renderSwift(prototype: string, lab: string, name: string) {
  const files: string[] = await renderInto(protoDir(prototype), { lab, name });
  await identify(prototype);
  const rels = files.map(f => path.relative(protoDir(prototype), path.resolve(repo, f)));
  return Promise.all(rels.map(async rel => ({ path: rel, url: await urlFor(prototype, rel) })));
}
