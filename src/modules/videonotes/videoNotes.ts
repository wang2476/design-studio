// The .videonotes format: { studioId, video: "clip.mp4", summary, notes: [{ id, t, text, author, createdAt }] }.
// t is seconds into the clip, or null for a note about the whole clip. Claude adds notes by editing the file
// with author "claude"; they show apart from yours.
export type Author = 'user' | 'claude';
export interface VideoNote { id: string; t: number | null; text: string; author: Author; createdAt: string }
export interface VideoNotes { video: string; summary: string; notes: VideoNote[] }

const MAX_TEXT = 4000;
export const VIDEO = /^[\w./ ()-]+\.(mp4|webm|mov|m4v)$/i;

/** Timed notes in time order; whole-clip notes last. */
export const sortNotes = (notes: VideoNote[]) => [...notes].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));

export function parseVideoNotes(source: string): VideoNotes | { error: string } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return { error: 'Video notes are not valid JSON' };
  }
  if (typeof raw.video !== 'string' || !VIDEO.test(raw.video) || raw.video.split('/').includes('..'))
    return { error: 'Video notes need "video": an .mp4, .webm, .mov or .m4v beside the file' };
  const notes = (Array.isArray(raw.notes) ? raw.notes : []).flatMap((n): VideoNote[] => {
    if (typeof n?.text !== 'string' || !n.text.trim()) return [];
    return [{
      id: typeof n.id === 'string' ? n.id : newNoteId(),
      t: typeof n.t === 'number' && Number.isFinite(n.t) && n.t >= 0 ? n.t : null,
      text: n.text.slice(0, MAX_TEXT),
      author: n.author === 'claude' ? 'claude' : 'user',
      createdAt: typeof n.createdAt === 'string' ? n.createdAt : '',
    }];
  });
  return { video: raw.video, summary: typeof raw.summary === 'string' ? raw.summary.slice(0, MAX_TEXT) : '', notes: sortNotes(notes) };
}

export const newNoteId = () => `n_${Math.random().toString(36).slice(2, 8)}`;

/** Rewrites the file with new notes, keeping every other field (studioId first). */
export function withNotes(source: string, next: Pick<VideoNotes, 'summary' | 'notes'>): string {
  const raw = JSON.parse(source) as Record<string, unknown>;
  return JSON.stringify({ ...raw, summary: next.summary, notes: sortNotes(next.notes) }, null, 2) + '\n';
}

export function formatTime(t: number | null): string {
  if (t === null) return 'clip';
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
}
