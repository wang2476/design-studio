// pnpm swift <Lab.swift under ios/> <name> <contributor>/<prototype folder>
//   pnpm swift App/DesignLab/ToastCardLab.swift toast_card aaron/layer-swift-spike
// Renders every #Preview in the Lab file and imports them into the prototype. An open page updates.
// New .swiftview files get their permanent studioId through `pnpm studio identify`.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderInto } from './node/renders.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [lab, name, target] = process.argv.slice(2);
if (!lab || !name || !/^[\w-]+\/[\w-]+$/.test(target ?? '')) {
  console.error('Usage: pnpm swift <Lab.swift under ios/> <name> <contributor>/<prototype folder>');
  process.exit(1);
}
try {
  const { log, written } = await renderInto(path.join(ROOT, 'src/prototypes', target), { lab, name });
  console.log(log);
  for (const file of written) console.log(`  ${path.relative(ROOT, file)}`);
  execFileSync(process.execPath, ['src/platform/node/cli/studio.js', 'identify', `src/prototypes/${target}`, '--yes'], { cwd: ROOT, stdio: 'inherit' });
} catch (error) {
  console.error(`swift: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
