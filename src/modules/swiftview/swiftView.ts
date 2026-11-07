// The .swiftview format: what DesignLab's renderer writes as <name>.layout.json, plus the image it
// describes and the file's permanent studioId. Frames are in points, origin top-left.
export interface SwiftElement { tag: string; file: string; line: number; x: number; y: number; width: number; height: number }
export interface SwiftView { image: string; width: number; height: number; scale: number; elements: SwiftElement[] }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseSwiftView(source: string): SwiftView | { error: string } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return { error: 'Swift view is not valid JSON' };
  }
  const { image, width, height, scale, elements } = raw;
  if (typeof image !== 'string' || !/^[\w./-]+\.png$/i.test(image) || image.includes('..')) {
    return { error: 'Swift view needs "image": a PNG beside it, like "toast_card_1.png"' };
  }
  if (!num(width) || !num(height) || width <= 0 || height <= 0) return { error: 'Swift view needs positive "width" and "height" in points' };
  const list = Array.isArray(elements) ? elements : [];
  const parsedElements = list.filter((e): e is SwiftElement => {
    const el = e as Partial<SwiftElement>;
    return typeof el.tag === 'string' && typeof el.file === 'string' && num(el.line)
      && num(el.x) && num(el.y) && num(el.width) && num(el.height);
  });
  return { image, width, height, scale: num(scale) && scale > 0 ? scale : 1, elements: parsedElements };
}

/** What Claude needs to change one tagged element: where it is in code, how big it is, and the ask. */
export function fixPrompt(view: string, el: SwiftElement, note: string): string {
  const frame = `x ${round(el.x)}, y ${round(el.y)}, ${round(el.width)} × ${round(el.height)} pt`;
  return [
    `In the Swift view ${view}, change the element tagged "${el.tag}" (${el.file}:${el.line}, ${frame}).`,
    note.trim() ? `Change: ${note.trim()}` : 'Change: (describe it)',
    'Edit that line, then re-render the view with scripts/designlab-render.sh.',
  ].join('\n');
}

const round = (n: number) => Math.round(n * 10) / 10;
