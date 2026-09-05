import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
const allowed = ['index.html', 'css', 'js', 'data', 'assets', 'images', 'audio', 'fonts'];
await fs.mkdir(output, { recursive: true });
for (const name of await fs.readdir(output)) if (!allowed.includes(name)) throw new Error(`Unexpected dist entry: ${name}. Move it out before building.`);
for (const name of allowed) {
  const source = path.join(root, name);
  try { await fs.access(source); } catch { continue; }
  await fs.cp(source, path.join(output, name), { recursive: true, filter: (sourcePath) => !path.basename(sourcePath).startsWith('.') });
}
console.log('Built dist/: public HTML, CSS, JavaScript, data and media only. API and secrets stay server-side.');
