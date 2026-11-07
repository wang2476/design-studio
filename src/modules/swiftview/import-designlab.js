// Turns DesignLab renders into Swift views: for each <name>.layout.json (with <name>.png beside it) in
// the source folder, copies the PNG into the prototype and writes <name>.swiftview. An existing
// .swiftview keeps its studioId, so re-rendering never breaks links to it.
// Usage: node src/modules/swiftview/import-designlab.js <design_iterations dir> <prototype dir>
import fs from 'node:fs';
import path from 'node:path';

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('Usage: node src/modules/swiftview/import-designlab.js <design_iterations dir> <prototype dir>');
  process.exit(1);
}
let count = 0;
for (const file of fs.readdirSync(from).filter(f => f.endsWith('.layout.json')).sort()) {
  const name = file.replace(/\.layout\.json$/, '');
  const png = path.join(from, `${name}.png`);
  if (!fs.existsSync(png)) { console.warn(`skip ${name}: no ${name}.png`); continue; }
  const layout = JSON.parse(fs.readFileSync(path.join(from, file), 'utf8'));
  const target = path.join(to, `${name}.swiftview`);
  const previous = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
  const view = { ...(previous.studioId && { studioId: previous.studioId }), image: `${name}.png`, ...layout };
  fs.copyFileSync(png, path.join(to, `${name}.png`));
  fs.writeFileSync(target, JSON.stringify(view, null, 2) + '\n');
  count++;
}
console.log(`Imported ${count} Swift view(s) into ${to}`);
