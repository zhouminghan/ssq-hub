import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'node_modules/katex');
const target = path.join(root, 'web/assets/vendor/katex');

function copyIfChanged(from, to) {
  const next = fs.readFileSync(from);
  return writeIfChanged(next, to);
}

function writeIfChanged(next, to) {
  const current = fs.existsSync(to) ? fs.readFileSync(to) : null;
  if (current?.equals(next)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, next);
  return true;
}

const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version;
copyIfChanged(path.join(source, 'dist/katex.mjs'), path.join(target, 'katex.mjs'));
copyIfChanged(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));

const readme = [
  '# KaTeX',
  '',
  `Vendored from KaTeX ${version} for offline MathML rendering.`,
  '',
  'Source: https://github.com/KaTeX/KaTeX',
  'License: MIT',
  '',
  'Run `npm run sync:katex` after upgrading the npm dependency.',
  '',
].join('\n');
writeIfChanged(Buffer.from(readme), path.join(target, 'README.md'));
