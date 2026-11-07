// The .round format. Options point at files in the same prototype by path relative to the .round file and
// keep their number for good: "toast-style #2" means the same thing after options are added or rejected.
// Pure rules, shared by the page, the check and the tests.
export const STATUSES = ['open', 'picked', 'rejected', 'superseded'] as const;
export type Status = typeof STATUSES[number];
export interface Option { n: number; path: string; label: string; status: Status }
export interface Check { text: string; done: boolean }
export interface Decision { option: number; why: string; costs: Record<string, string>; checks: Check[]; date: string }
export interface Round { question: string; options: Option[]; decision: Decision | null }

const MAX = 4000;
const PATH = /^[\w./ -]+$/;
const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX) : '');
const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);

export function parseRound(source: string): Round | { error: string } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return { error: 'Round is not valid JSON' };
  }
  if (typeof raw.question !== 'string' || !raw.question.trim()) return { error: 'A round needs "question": what it decides' };
  const seen = new Set<number>();
  const options = (Array.isArray(raw.options) ? raw.options : []).flatMap((o): Option[] => {
    if (!Number.isInteger(o?.n) || o.n < 1 || seen.has(o.n) || typeof o.path !== 'string' || !PATH.test(o.path) || o.path.split('/').includes('..')) return [];
    seen.add(o.n);
    return [{ n: o.n, path: o.path, label: text(o.label), status: isStatus(o.status) ? o.status : 'open' }];
  });
  const d = raw.decision as Record<string, unknown> | null | undefined;
  const decision = d && Number.isInteger(d.option) && seen.has(d.option as number) ? {
    option: d.option as number,
    why: text(d.why),
    costs: Object.fromEntries(Object.entries((d.costs ?? {}) as Record<string, unknown>)
      .filter(([k, v]) => seen.has(Number(k)) && typeof v === 'string').map(([k, v]) => [k, text(v)])),
    checks: (Array.isArray(d.checks) ? d.checks : []).flatMap((c): Check[] =>
      typeof c?.text === 'string' && c.text.trim() ? [{ text: text(c.text), done: c.done === true }] : []),
    date: text(d.date),
  } : null;
  return { question: raw.question.slice(0, MAX), options, decision };
}

/** Adds a file as the next option, numbered one past the highest ever used. Adding it twice is a no-op. */
export function addOption(round: Round, path: string, label = ''): Round {
  if (round.options.some(o => o.path === path)) return round;
  const n = Math.max(0, ...round.options.map(o => o.n)) + 1;
  return { ...round, options: [...round.options, { n, path, label: label.trim(), status: 'open' }] };
}

export function setStatus(round: Round, n: number, status: Status): Round {
  return { ...round, options: round.options.map(o => (o.n === n ? { ...o, status } : o)) };
}

/** Records the pick: it becomes picked, other open options become rejected. Needs a reason. */
export function decide(round: Round, option: number, why: string, checks: string[] = [], date = new Date().toISOString().slice(0, 10)): Round {
  if (!round.options.some(o => o.n === option)) throw new Error(`No option #${option}`);
  if (!why.trim()) throw new Error('Say why this option won');
  return {
    ...round,
    options: round.options.map(o => (o.n === option ? { ...o, status: 'picked' } : o.status === 'open' ? { ...o, status: 'rejected' } : o)),
    decision: { option, why: why.trim(), costs: round.decision?.costs ?? {}, checks: checks.filter(c => c.trim()).map(t => ({ text: t.trim(), done: false })), date },
  };
}

/** Clears the pick so the round is open again; rejected options stay rejected. */
export function reopen(round: Round): Round {
  return { ...round, decision: null, options: round.options.map(o => (o.status === 'picked' ? { ...o, status: 'open' } : o)) };
}

export function toggleCheck(round: Round, index: number): Round {
  if (!round.decision) return round;
  const checks = round.decision.checks.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
  return { ...round, decision: { ...round.decision, checks } };
}

/** Writes a round back, keeping the file's other fields (studioId) in place. */
export function serialize(previousSource: string, round: Round): string {
  const raw = JSON.parse(previousSource) as Record<string, unknown>;
  return JSON.stringify({ ...raw, ...round }, null, 2) + '\n';
}

/** A plain summary to paste to Claude. */
export function summary(name: string, round: Round): string {
  const lines = [`Round ${name}: ${round.question}`];
  for (const o of round.options) lines.push(`  #${o.n} ${o.path}${o.label ? ` (${o.label})` : ''}: ${o.status}`);
  const d = round.decision;
  if (d) {
    lines.push(`Picked #${d.option} on ${d.date}. Why: ${d.why}`);
    for (const c of d.checks) lines.push(`  [${c.done ? 'x' : ' '}] ${c.text}`);
  }
  return lines.join('\n');
}
