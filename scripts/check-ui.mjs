import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/src');
const uiDir = path.join(root, 'components', 'ui');
const tag = /<(input|select|textarea)\b/g;
let count = 0;
const rows = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (full.startsWith(uiDir)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!full.endsWith('.jsx') && !full.endsWith('.js')) continue;
    const text = fs.readFileSync(full, 'utf8');
    const hits = text.match(tag);
    if (!hits) continue;
    count += hits.length;
    rows.push(`${hits.length}\t${path.relative(root, full)}`);
  }
}

walk(root);
console.log(`RAW_CONTROLS ${count}`);
rows.sort().forEach((row) => console.log(row));
process.exit(count === 0 ? 0 : 1);
