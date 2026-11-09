// A reference clip with its notes. "At playhead" pins a note to the current time; clicking a time seeks
// there. Edits re-read the file and apply to the latest copy, so a note Claude just wrote is never lost.
import { useEffect, useRef, useState } from 'react';
import { Video01Icon } from '@hugeicons/core-free-icons';
import { canChangePrototype, readSource, useMe, writeSource, type ArtifactContext, type EmbedProps, type FileTypeModule } from '#studio/data';
import { useLiveFile } from '../useLiveFile';
import { files, videos } from './loader';
import { formatTime, newNoteId, parseVideoNotes, withNotes, type VideoNote, type VideoNotes } from './videoNotes';

type Loaded = { clip: VideoNotes; videoUrl: string | null } | { error: string };
type Props = ArtifactContext & { loaded: Loaded };

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');

async function sourceOf({ proto, item }: ArtifactContext): Promise<string | undefined> {
  if (import.meta.env.DEV) return (await readSource(proto, item.path)).content;
  return files[`/prototypes/${proto.contributorKey}/${proto.id}/${item.path}`]?.();
}

async function load(ctx: ArtifactContext): Promise<Loaded | undefined> {
  try {
    const source = await sourceOf(ctx);
    if (source === undefined) return undefined;
    const clip = parseVideoNotes(source);
    if ('error' in clip) return clip;
    return { clip, videoUrl: videos[`/prototypes/${ctx.proto.contributorKey}/${ctx.proto.id}/${dirOf(ctx.item.path)}${clip.video}`] ?? null };
  } catch (err) {
    console.error(`[videonotes] could not read ${ctx.item.path}:`, err);
    return { error: `Could not read ${ctx.item.path}` };
  }
}

/** Applies a change to the file as it is on disk now. */
async function update(ctx: ArtifactContext, change: (clip: VideoNotes) => Pick<VideoNotes, 'summary' | 'notes'>) {
  const { content, version } = await readSource(ctx.proto, ctx.item.path);
  const clip = parseVideoNotes(content);
  if ('error' in clip) throw new Error(clip.error);
  await writeSource(ctx.proto, ctx.item.path, withNotes(content, change(clip)), version);
}

function Notes({ ctx, clip, editable, onSeek, now }: {
  ctx: ArtifactContext; clip: VideoNotes; editable: boolean; onSeek: (t: number) => void; now: () => number;
}) {
  const [summary, setSummary] = useState(clip.summary);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setSummary(clip.summary), [clip.summary]);

  const save = (change: Parameters<typeof update>[1]) =>
    update(ctx, change).then(() => setError(''), (err: unknown) => {
      console.error('[videonotes] saving failed:', err);
      setError('Could not save. Check the console.');
    });
  const add = (pinned: boolean) => {
    const text = draft.trim();
    if (!text) return;
    const note: VideoNote = { id: newNoteId(), t: pinned ? Math.round(now() * 10) / 10 : null, text, author: 'user', createdAt: new Date().toISOString() };
    setDraft('');
    void save(c => ({ summary: c.summary, notes: [...c.notes, note] }));
  };

  return (
    <div className='space-y-3 text-sm'>
      <textarea value={summary} readOnly={!editable} rows={3} placeholder='Why is this clip here? What should we borrow?'
        onChange={e => setSummary(e.target.value)}
        onBlur={() => summary !== clip.summary && void save(c => ({ summary, notes: c.notes }))}
        className='w-full rounded-md border border-border bg-background p-2' />
      <ul className='space-y-2'>
        {clip.notes.map(n => (
          <li key={n.id} className={`flex items-start gap-2 rounded-md border p-2 ${n.author === 'claude' ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
            {n.t === null
              ? <span className='shrink-0 text-xs text-muted-foreground'>clip</span>
              : <button type='button' onClick={() => onSeek(n.t!)} title='Jump to this moment'
                  className='shrink-0 font-mono text-xs text-primary hover:underline'>{formatTime(n.t)}</button>}
            <span className='min-w-0 flex-1 whitespace-pre-wrap'>{n.text}</span>
            <span className='shrink-0 text-xs text-muted-foreground'>{n.author === 'claude' ? 'Claude' : 'You'}</span>
            {editable && <button type='button' aria-label='Delete note' className='text-muted-foreground hover:text-foreground'
              onClick={() => void save(c => ({ summary: c.summary, notes: c.notes.filter(x => x.id !== n.id) }))}>×</button>}
          </li>
        ))}
      </ul>
      {editable && (
        <div className='flex gap-2'>
          <input value={draft} placeholder='Note at the playhead…' onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add(true)}
            className='min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1' />
          <button type='button' onClick={() => add(true)} className='rounded-md bg-primary px-2 py-1 text-primary-foreground'>At playhead</button>
          <button type='button' onClick={() => add(false)} className='rounded-md border border-border px-2 py-1'>Whole clip</button>
        </div>
      )}
      {error && <p className='text-xs text-destructive'>{error}</p>}
    </div>
  );
}

function VideoNotesPage({ proto, item, loaded: initial }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const me = useMe();
  const loaded = useLiveFile({ proto, item }, initial, () => load({ proto, item }));
  if ('error' in loaded) return <div className='p-8 text-sm text-destructive'>{loaded.error}</div>;
  const seek = (t: number) => {
    if (!video.current) return;
    video.current.currentTime = t;
    video.current.pause();
  };
  return (
    <div className='flex min-h-0 min-w-0 flex-1 bg-background text-foreground'>
      <div className='flex min-w-0 flex-1 items-start justify-center overflow-auto p-8'>
        {loaded.videoUrl
          ? <video ref={video} src={loaded.videoUrl} controls preload='metadata' className='max-h-[80vh] max-w-full rounded-lg shadow-lg' />
          : <p className='text-sm text-muted-foreground'>Missing video: {loaded.clip.video}</p>}
      </div>
      <aside className='shrink-0 overflow-auto border-l border-border p-4' style={{ width: 360 }}>
        <Notes ctx={{ proto, item }} clip={loaded.clip} editable={import.meta.env.DEV && canChangePrototype(proto, me)}
          onSeek={seek} now={() => video.current?.currentTime ?? 0} />
      </aside>
    </div>
  );
}

function VideoNotesEmbed({ proto, item, width, height }: EmbedProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    void load({ proto, item }).then(result => { if (live) setLoaded(result ?? { error: 'Not found' }); });
    return () => { live = false; };
  }, [proto, item]);
  if (!loaded || 'error' in loaded || !loaded.videoUrl) return null;
  return <video aria-hidden src={loaded.videoUrl} muted preload='metadata' className='object-contain' style={{ width, height }} />;
}

export default {
  icon: Video01Icon,
  async load(ctx) {
    const loaded = await load(ctx);
    return loaded && { ...ctx, loaded };
  },
  Page: VideoNotesPage,
  Embed: VideoNotesEmbed,
} satisfies FileTypeModule<Props>;
