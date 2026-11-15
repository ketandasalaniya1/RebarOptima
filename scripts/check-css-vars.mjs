/**
 * Every var(--name) under frontend/src must be defined as a custom property
 * in some stylesheet in that tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/src');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(css|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
walk(root);

const defined = new Set();
const uses = [];
const defRe = /(?<![\w-])--([A-Za-z_][\w-]*)\s*:/g;
const useRe = /var\(\s*--([A-Za-z_][\w-]*)/g;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.css')) {
    for (const match of text.matchAll(defRe)) defined.add(match[1]);
  }
  for (const match of text.matchAll(useRe)) {
    uses.push({ name: match[1], file: path.relative(root, file) });
  }
}

const missing = [];
const seen = new Set();
for (const use of uses) {
  if (defined.has(use.name)) continue;
  const key = `${use.name}\t${use.file}`;
  if (seen.has(key)) continue;
  seen.add(key);
  missing.push(use);
}

const probe = [
  '.a { color: var(--bg-card); }',
  "border: var(--border-color, #fff);",
  "style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--bg-primary)' }}",
].join('\n');
const probed = [...probe.matchAll(useRe)].map((match) => match[1]);
for (const name of ['bg-card', 'bg-secondary', 'bg-primary', 'border-color']) {
  if (!probed.includes(name)) {
    console.error(`PROBE_MISS=${name}`);
    process.exit(2);
  }
}
console.log(`PROBE=${probed.join(',')}`);

const tracked = ['bg-card', 'bg-secondary', 'bg-primary', 'border-color'];
for (const name of tracked) {
  const sites = uses.filter((item) => item.name === name);
  const byFile = new Map();
  for (const site of sites) byFile.set(site.file, (byFile.get(site.file) || 0) + 1);
  console.log(`TRACKED ${name} USES=${sites.length} FILES=${byFile.size}`);
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${count}\t${file}`);
  }
}

const names = new Set(missing.map((item) => item.name));
console.log(`DEFINED=${defined.size}`);
console.log(`USES=${uses.length}`);
console.log(`UNDEFINED_VARS=${names.size}`);
console.log(`UNDEFINED_SITES=${missing.length}`);
for (const item of missing) console.log(`${item.name}\t${item.file}`);
process.exit(missing.length ? 1 : 0);
