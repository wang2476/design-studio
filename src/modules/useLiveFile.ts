// Keeps a page's loaded data in step with its file on disk, so an agent's edit (the MCP, a render, any
// editor) shows up in an open page without a reload, the way an artifact updates in place. Same signal
// the canvas uses: the dev server's 'studio:file' event for that one file.
import { useEffect, useState } from 'react';
import type { ArtifactContext } from '#studio/data';

export function useLiveFile<T>(ctx: ArtifactContext, initial: T, reload: () => Promise<T | undefined>): T {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const { contributorKey, id } = ctx.proto;
  const path = ctx.item.path;
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return undefined;
    let live = true;
    const onFile = (change: { contributor: string; prototype: string; path: string }) => {
      if (change.contributor !== contributorKey || change.prototype !== id || change.path !== path) return;
      reload().then(next => { if (live && next !== undefined) setValue(next); },
        (err: unknown) => console.error(`[live] could not reload ${path}:`, err));
    };
    hot.on('studio:file', onFile);
    return () => { live = false; hot.off?.('studio:file', onFile); };
    // reload closes over ctx, which these keys identify
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorKey, id, path]);
  return value;
}
