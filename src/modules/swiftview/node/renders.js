// Renders SwiftUI #Previews with the app's DesignLab script (axe) and imports them as Swift views.
// Shared by `pnpm swift` (cli.js) and the Re-render button (server.ts).
//
// The app writes <name>_<n>.png and <name>_<n>.layout.json into <app>/.superdesign/design_iterations.
// importRenders copies each pair into the prototype as <name>_<n>.png + <name>_<n>.swiftview, keeping
// an existing studioId so links survive, and stamps `rendered` so open pages drop the cached image.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const NAME = /^[a-z0-9][a-z0-9_-]{0,60}$/i;
const LAB = /^[\w./-]+\.swift$/;

/** The iOS app checkout. ponytail: one app per machine via SWIFT_APP_ROOT; per-studio config if a team needs two. */
export const appRoot = () => process.env.SWIFT_APP_ROOT || path.join(os.homedir(), 'Documents/GitHub/layer-designlab');

export function checkSource({ lab, name }) {
  if (typeof lab !== 'string' || !LAB.test(lab) || lab.split('/').includes('..')) throw new Error(`Not a Swift file path under ios/: ${lab}`);
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`Not a render name (letters, digits, _ and -): ${name}`);
  return { lab, name };
}

/** Runs ios/scripts/designlab-render.sh for one Lab file. Takes ~20 s with a warm build, minutes cold. */
export async function render(source, app = appRoot()) {
  const { lab, name } = checkSource(source);
  const ios = path.join(app, 'ios');
  if (!fs.existsSync(path.join(ios, 'scripts/designlab-render.sh'))) throw new Error(`No ios/scripts/designlab-render.sh in ${app} (set SWIFT_APP_ROOT)`);
  if (!fs.existsSync(path.join(ios, lab))) throw new Error(`No ${lab} in ${ios}`);
  const { stdout } = await run('sh', ['scripts/designlab-render.sh', lab, name], {
    cwd: ios, env: { ...process.env, DL_ROOT: app }, maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60_000,
  });
  return stdout.trim().split('\n').at(-1) ?? '';
}

/** Copies <name>_<n> renders from the app into the prototype folder. Returns the .swiftview paths written. */
export function importRenders(from, to, source) {
  const { name } = checkSource(source);
  const own = new RegExp(`^${name}_\\d+(_\\d+)*\\.layout\\.json$`);
  const rendered = new Date().toISOString();
  const written = [];
  for (const file of fs.readdirSync(from).filter(f => own.test(f)).sort()) {
    const base = file.replace(/\.layout\.json$/, '');
    const png = path.join(from, `${base}.png`);
    if (!fs.existsSync(png)) { console.warn(`[swiftview] skip ${base}: no ${base}.png`); continue; }
    const layout = JSON.parse(fs.readFileSync(path.join(from, file), 'utf8'));
    const target = path.join(to, `${base}.swiftview`);
    const previous = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
    const view = { ...(previous.studioId && { studioId: previous.studioId }), image: `${base}.png`, rendered, source, ...layout };
    fs.copyFileSync(png, path.join(to, `${base}.png`));
    fs.writeFileSync(target, JSON.stringify(view, null, 2) + '\n');
    written.push(target);
  }
  return written;
}

/** Render, then import into the prototype. */
export async function renderInto(prototypeDir, source, app = appRoot()) {
  const log = await render(source, app);
  const written = importRenders(path.join(app, '.superdesign/design_iterations'), prototypeDir, source);
  if (!written.length) throw new Error(`Rendered, but found no ${source.name}_<n>.layout.json. Does the preview root use .designLabDraft("${source.name}", n)?`);
  return { log, written };
}
