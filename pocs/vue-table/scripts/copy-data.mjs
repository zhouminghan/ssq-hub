import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const source = path.join(root, 'web/data');
const target = path.join(import.meta.dirname, '../public/data');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied ${source} -> ${target}`);
