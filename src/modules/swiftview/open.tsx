// How the app opens a Swift view: the SwiftUI render at 1 pt = 1 CSS px, with a box over every tagged
// element. Selecting one shows its file:line and frame and copies a fix prompt for the coding agent.
// Embeds show the render fitted to their box.
import { useEffect, useState } from 'react';
import { SmartPhone01Icon } from '@hugeicons/core-free-icons';
import { callModule, readSource, useMe, type ArtifactContext, type EmbedProps, type FileTypeModule } from '#studio/data';
import { useLiveFile } from '../useLiveFile';
import { files, images } from './loader';
import { fixPrompt, parseSwiftView, type SwiftElement, type SwiftView } from './swiftView';

type Loaded = { view: SwiftView; imageUrl: string | null } | { error: string };
type Props = ArtifactContext & { loaded: Loaded };

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.swiftview$/, '');

async function sourceOf({ proto, item }: ArtifactContext): Promise<string | undefined> {
  if (import.meta.env.DEV) return (await readSource(proto, item.path)).content;
  return files[`/prototypes/${proto.contributorKey}/${proto.id}/${item.path}`]?.();
}

function resolve(ctx: ArtifactContext, source: string): Loaded {
  const view = parseSwiftView(source);
  if ('error' in view) return view;
  const key = `/prototypes/${ctx.proto.contributorKey}/${ctx.proto.id}/${dirOf(ctx.item.path)}${view.image}`;
  const url = images[key];
  // Re-rendering keeps the file name, so the stamp is what makes the browser fetch the new pixels.
  return { view, imageUrl: url ? `${url}${view.rendered ? `${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(view.rendered)}` : ''}` : null };
}

async function load(ctx: ArtifactContext): Promise<Loaded | undefined> {
  try {
    const source = await sourceOf(ctx);
    return source === undefined ? undefined : resolve(ctx, source);
  } catch (err) {
    console.error(`[swiftview] could not read ${ctx.item.path}:`, err);
    return { error: `Could not read ${ctx.item.path}` };
  }
}

function Render({ view, imageUrl, selected, onSelect }: {
  view: SwiftView; imageUrl: string | null; selected?: SwiftElement | null; onSelect?: (el: SwiftElement) => void;
}) {
  return (
    <div className='relative shrink-0 overflow-hidden rounded-[28px] shadow-lg' style={{ width: view.width, height: view.height }}>
      {imageUrl
        ? <img src={imageUrl} alt='' width={view.width} height={view.height} draggable={false} className='block' />
        : <div className='flex size-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground'>Missing render: {view.image}</div>}
      {onSelect && view.elements.map(el => (
        <button
          key={`${el.tag}:${el.line}:${el.x}:${el.y}`}
          type='button'
          aria-label={`${el.tag}, ${Math.round(el.width)} by ${Math.round(el.height)} points`}
          onClick={() => onSelect(el)}
          className={`absolute rounded-sm border transition-colors ${selected === el ? 'border-primary bg-primary/15' : 'border-primary/40 hover:border-primary hover:bg-primary/10'}`}
          style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
        />
      ))}
    </div>
  );
}

function Inspector({ name, el }: { name: string; el: SwiftElement | null }) {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setNote(''); setCopied(false); }, [el]);
  if (!el) return <p className='text-sm text-muted-foreground'>Select a tagged element to see its source and frame.</p>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fixPrompt(name, el, note));
      setCopied(true);
    } catch (err) {
      console.error('[swiftview] copying the fix prompt failed:', err);
    }
  };
  return (
    <div className='space-y-3 text-sm'>
      <div className='font-semibold text-foreground'>{el.tag}</div>
      <code className='block break-all text-xs text-muted-foreground'>{el.file}:{el.line}</code>
      <div className='text-xs text-muted-foreground'>x {Math.round(el.x)} · y {Math.round(el.y)} · {Math.round(el.width)} × {Math.round(el.height)} pt</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder='What should change?' rows={3}
        className='w-full rounded-md border border-border bg-background p-2 text-sm' />
      <button type='button' onClick={() => void copy()} className='rounded-md bg-primary px-3 py-1.5 text-primary-foreground'>
        {copied ? 'Copied' : 'Copy fix prompt'}
      </button>
    </div>
  );
}

// Runs the view's Lab file through the renderer again (server.ts). The page updates when the files land.
function Rerender({ proto, item, view }: ArtifactContext & { view: SwiftView }) {
  const me = useMe();
  const [state, setState] = useState<{ busy: boolean; message: string }>({ busy: false, message: '' });
  if (!import.meta.env.DEV || !view.source || me !== proto.contributorKey) return null;
  const run = async () => {
    setState({ busy: true, message: 'Rendering on the simulator…' });
    try {
      const { log } = await callModule<{ log: string }>('swiftview', 'render', { contributor: proto.contributorKey, prototype: proto.id, path: item.path });
      setState({ busy: false, message: log || 'Rendered' });
    } catch (err) {
      console.error('[swiftview] re-render failed:', err);
      setState({ busy: false, message: err instanceof Error ? err.message : String(err) });
    }
  };
  return (
    <div className='space-y-1'>
      <button type='button' disabled={state.busy} onClick={() => void run()}
        className='rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50'>
        {state.busy ? 'Rendering…' : 'Re-render'}
      </button>
      <div className='break-all text-xs text-muted-foreground'>{state.message || `${view.source.lab}`}</div>
    </div>
  );
}

function SwiftViewPage({ proto, item, loaded: initial }: Props) {
  const [selected, setSelected] = useState<SwiftElement | null>(null);
  const loaded = useLiveFile({ proto, item }, initial, () => load({ proto, item }));
  if ('error' in loaded) return <div className='p-8 text-sm text-destructive'>{loaded.error}</div>;
  return (
    <div className='flex min-h-0 min-w-0 flex-1 bg-background text-foreground'>
      <div className='flex min-w-0 flex-1 items-start justify-center overflow-auto p-8'>
        <Render view={loaded.view} imageUrl={loaded.imageUrl} selected={selected} onSelect={setSelected} />
      </div>
      <aside className='shrink-0 space-y-4 border-l border-border p-4' style={{ width: 288 }}>
        <Rerender proto={proto} item={item} view={loaded.view} />
        <div className='text-xs uppercase text-muted-foreground'>{loaded.view.elements.length} tagged</div>
        <Inspector name={nameOf(item.path)} el={selected} />
      </aside>
    </div>
  );
}

function SwiftViewEmbed({ proto, item, width, height }: EmbedProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    void load({ proto, item }).then(result => { if (live) setLoaded(result ?? { error: 'Not found' }); });
    return () => { live = false; };
  }, [proto, item]);
  if (!loaded || 'error' in loaded || width <= 0 || height <= 0) return null;
  const scale = Math.min(width / loaded.view.width, height / loaded.view.height);
  return (
    <div aria-hidden inert className='relative flex items-start justify-center overflow-hidden' style={{ width, height }}>
      <div className='origin-top' style={{ transform: `scale(${scale})` }}>
        <Render view={loaded.view} imageUrl={loaded.imageUrl} />
      </div>
    </div>
  );
}

export default {
  icon: SmartPhone01Icon,
  async load(ctx) {
    const loaded = await load(ctx);
    return loaded && { ...ctx, loaded };
  },
  Page: SwiftViewPage,
  Embed: SwiftViewEmbed,
} satisfies FileTypeModule<Props>;
