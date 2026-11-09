// A decision round: the options side by side as live previews, then the pick, why, and follow-up checks.
// Edits re-read the file and apply to the latest copy, so a change Claude just wrote is kept.
import { useEffect, useState } from 'react';
import { CheckListIcon } from '@hugeicons/core-free-icons';
import { canChangePrototype, readSource, useMe, writeSource, type ArtifactContext, type FileTypeModule } from '#studio/data';
import { ArtifactHost } from '#studio/ui';
import { useLiveFile } from '../useLiveFile';
import { files } from './loader';
import { addOption, decide, parseRound, reopen, serialize, setStatus, summary, toggleCheck, type Option, type Round } from './round';

type Loaded = { round: Round } | { error: string };
type Props = ArtifactContext & { loaded: Loaded };

const PREVIEW = { width: 320, height: 560 };
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.round$/, '');
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');
const badge: Record<Option['status'], string> = {
  open: 'text-muted-foreground', picked: 'bg-primary text-primary-foreground', rejected: 'text-muted-foreground line-through', superseded: 'text-muted-foreground italic',
};

async function load(ctx: ArtifactContext): Promise<Loaded | undefined> {
  try {
    const source = import.meta.env.DEV
      ? (await readSource(ctx.proto, ctx.item.path)).content
      : await files[`/prototypes/${ctx.proto.contributorKey}/${ctx.proto.id}/${ctx.item.path}`]?.();
    if (source === undefined) return undefined;
    const round = parseRound(source);
    return 'error' in round ? round : { round };
  } catch (err) {
    console.error(`[rounds] could not read ${ctx.item.path}:`, err);
    return { error: `Could not read ${ctx.item.path}` };
  }
}

async function update(ctx: ArtifactContext, change: (round: Round) => Round) {
  const { content, version } = await readSource(ctx.proto, ctx.item.path);
  const round = parseRound(content);
  if ('error' in round) throw new Error(round.error);
  await writeSource(ctx.proto, ctx.item.path, serialize(content, change(round)), version);
}

function OptionCard({ ctx, option, editable, onChange }: {
  ctx: ArtifactContext; option: Option; editable: boolean; onChange: (change: (r: Round) => Round) => void;
}) {
  const relative = option.path.startsWith(dirOf(ctx.item.path)) ? option.path : `${dirOf(ctx.item.path)}${option.path}`;
  return (
    <div className='flex shrink-0 flex-col gap-2' style={{ width: PREVIEW.width }}>
      <div className='flex items-center gap-2 text-sm'>
        <span className='font-semibold'>#{option.n}</span>
        <span className='min-w-0 flex-1 truncate text-muted-foreground' title={relative}>{option.label || option.path}</span>
        <span className={`rounded px-1.5 text-xs ${badge[option.status]}`}>{option.status}</span>
      </div>
      <ArtifactHost request={{ reference: `./${option.path}`, origin: ctx, surface: 'document' }}
        width={PREVIEW.width} height={PREVIEW.height} interaction='inert' className='overflow-hidden rounded-lg border border-border' />
      {editable && option.status !== 'picked' && (
        <div className='flex gap-2 text-xs'>
          {option.status !== 'rejected' && <button type='button' className='rounded border border-border px-2 py-0.5' onClick={() => onChange(r => setStatus(r, option.n, 'rejected'))}>Reject</button>}
          {option.status !== 'superseded' && <button type='button' className='rounded border border-border px-2 py-0.5' onClick={() => onChange(r => setStatus(r, option.n, 'superseded'))}>Superseded</button>}
          {option.status !== 'open' && <button type='button' className='rounded border border-border px-2 py-0.5' onClick={() => onChange(r => setStatus(r, option.n, 'open'))}>Reopen</button>}
        </div>
      )}
    </div>
  );
}

function DecisionPanel({ round, editable, onChange }: { round: Round; editable: boolean; onChange: (change: (r: Round) => Round) => void }) {
  const choices = round.options.filter(o => o.status !== 'superseded');
  const [pick, setPick] = useState(choices[0]?.n ?? 0);
  const [why, setWhy] = useState('');
  const [checks, setChecks] = useState('');
  useEffect(() => { if (!choices.some(o => o.n === pick)) setPick(choices[0]?.n ?? 0); }, [choices, pick]);
  const d = round.decision;
  if (d) return (
    <section className='space-y-2 rounded-lg border border-border p-4 text-sm'>
      <div className='font-semibold'>Picked #{d.option} <span className='font-normal text-muted-foreground'>on {d.date}</span></div>
      <p className='whitespace-pre-wrap'>{d.why}</p>
      {d.checks.length > 0 && (
        <ul className='space-y-1'>
          {d.checks.map((c, i) => (
            <li key={i}><label className='flex items-center gap-2'>
              <input type='checkbox' checked={c.done} disabled={!editable} onChange={() => onChange(r => toggleCheck(r, i))} />{c.text}
            </label></li>
          ))}
        </ul>
      )}
      {editable && <button type='button' className='rounded border border-border px-2 py-1 text-xs' onClick={() => onChange(reopen)}>Reopen round</button>}
    </section>
  );
  if (!editable || !choices.length) return null;
  return (
    <section className='space-y-2 rounded-lg border border-border p-4 text-sm'>
      <div className='font-semibold'>Record the pick</div>
      <select value={pick} onChange={e => setPick(Number(e.target.value))} className='rounded border border-border bg-background px-2 py-1'>
        {choices.map(o => <option key={o.n} value={o.n}>#{o.n} {o.label || o.path}</option>)}
      </select>
      <textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder='Why does this one win?'
        className='w-full rounded-md border border-border bg-background p-2' />
      <textarea value={checks} onChange={e => setChecks(e.target.value)} rows={2} placeholder='Follow-up checks, one per line (optional)'
        className='w-full rounded-md border border-border bg-background p-2' />
      <button type='button' disabled={!why.trim()} className='rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50'
        onClick={() => onChange(r => decide(r, pick, why, checks.split('\n')))}>Pick #{pick}</button>
    </section>
  );
}

function AddOption({ ctx, round, onChange }: { ctx: ArtifactContext; round: Round; onChange: (change: (r: Round) => Round) => void }) {
  const dir = dirOf(ctx.item.path);
  const candidates = ctx.proto.artifacts
    .filter(a => a.path !== ctx.item.path && a.fileType !== 'rounds' && a.path.startsWith(dir))
    .map(a => a.path.slice(dir.length))
    .filter(p => !round.options.some(o => o.path === p));
  if (!candidates.length) return null;
  return (
    <select value='' onChange={e => e.target.value && onChange(r => addOption(r, e.target.value))}
      className='rounded border border-border bg-background px-2 py-1 text-sm'>
      <option value=''>Add an option…</option>
      {candidates.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

function RoundPage({ proto, item, loaded: initial }: Props) {
  const me = useMe();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ctx = { proto, item };
  const loaded = useLiveFile(ctx, initial, () => load(ctx));
  if ('error' in loaded) return <div className='p-8 text-sm text-destructive'>{loaded.error}</div>;
  const { round } = loaded;
  const editable = import.meta.env.DEV && canChangePrototype(proto, me);
  const onChange = (change: (r: Round) => Round) =>
    void update(ctx, change).then(() => setError(''), (err: unknown) => {
      console.error('[rounds] saving failed:', err);
      setError(err instanceof Error ? err.message : 'Could not save. Check the console.');
    });
  const copy = () => navigator.clipboard.writeText(summary(nameOf(item.path), round))
    .then(() => setCopied(true), (err: unknown) => console.error('[rounds] copy failed:', err));
  return (
    <div className='min-h-0 min-w-0 flex-1 space-y-6 overflow-auto bg-background p-8 text-foreground'>
      <header className='flex flex-wrap items-center gap-3'>
        <h1 className='min-w-0 flex-1 text-xl font-semibold'>{round.question}</h1>
        {editable && <AddOption ctx={ctx} round={round} onChange={onChange} />}
        <button type='button' className='rounded border border-border px-2 py-1 text-sm' onClick={() => void copy()}>{copied ? 'Copied' : 'Copy for Claude'}</button>
      </header>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <DecisionPanel round={round} editable={editable} onChange={onChange} />
      {round.options.length
        ? <div className='flex gap-6 overflow-x-auto pb-4'>{round.options.map(o => <OptionCard key={o.n} ctx={ctx} option={o} editable={editable} onChange={onChange} />)}</div>
        : <p className='text-sm text-muted-foreground'>No options yet. Add files from this prototype as options.</p>}
    </div>
  );
}

export default {
  icon: CheckListIcon,
  async load(ctx) {
    const loaded = await load(ctx);
    return loaded && { ...ctx, loaded };
  },
  Page: RoundPage,
} satisfies FileTypeModule<Props>;
