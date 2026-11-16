import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/src');
const uiDir = path.join(root, 'components', 'ui');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (full.startsWith(uiDir)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (full.endsWith('.jsx')) out.push(full);
  }
  return out;
}

function relImport(file) {
  let rel = path.relative(path.dirname(file), uiDir).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

let changed = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  const needs = [];
  if (/<input\b/.test(text)) needs.push('Input');
  if (/<select\b/.test(text)) needs.push('Select');
  if (/<textarea\b/.test(text)) needs.push('Textarea');
  if (needs.length === 0) continue;
  text = text.replace(/<input\b/g, '<Input').replace(/<select\b/g, '<Select').replace(/<\/select>/g, '</Select>');
  text = text.replace(/<textarea\b/g, '<Textarea').replace(/<\/textarea>/g, '</Textarea>');
  const ui = text.match(/import\s*\{([\s\S]*?)\}\s*from\s*(['"])([^'"]*components\/ui)\2/);
  if (ui) {
    const have = ui[1].split(',').map((part) => part.trim()).filter(Boolean);
    const add = needs.filter((name) => !have.includes(name));
    if (add.length) {
      const next = `import { ${[...have, ...add].join(', ')} } from ${ui[2]}${ui[3]}${ui[2]}`;
      text = text.replace(ui[0], next);
    }
  } else {
    const line = `import { ${needs.join(', ')} } from '${relImport(file)}';\n`;
    const last = text.match(/^(import[\s\S]*?;\n)+/);
    text = last ? text.replace(last[0], `${last[0]}${line}`) : `${line}${text}`;
  }
  fs.writeFileSync(file, text);
  changed += 1;
}
console.log(`MIGRATED_FILES ${changed}`);
