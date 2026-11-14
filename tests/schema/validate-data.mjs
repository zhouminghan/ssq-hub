import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(import.meta.dirname, '../..');
const schemaDir = path.join(root, 'schemas');
const dataDir = path.join(root, 'web/data');
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

for (const file of fs.readdirSync(schemaDir).filter((name) => name.endsWith('.json'))) {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
  ajv.addSchema(schema, file);
}

const checks = [
  ['history-index.schema.json', path.join(dataDir, 'history_index.json')],
  ['latest.schema.json', path.join(dataDir, 'latest.json')],
  ['stats.schema.json', path.join(dataDir, 'stats.json')],
  ['manifest.schema.json', path.join(dataDir, 'manifest.json')],
  ['history-baseline.schema.json', path.join(dataDir, 'history_baseline.json')],
  ['source-state.schema.json', path.join(dataDir, 'source_state.json')],
];

const historyDir = path.join(dataDir, 'history');
for (const file of fs.readdirSync(historyDir).filter((name) => name.endsWith('.json'))) {
  checks.push(['history.schema.json', path.join(historyDir, file)]);
}

const corrections = path.join(dataDir, 'corrections.json');
if (fs.existsSync(corrections)) checks.push(['corrections.schema.json', corrections]);

let failed = false;
for (const [schemaName, dataPath] of checks) {
  const validate = ajv.getSchema(schemaName);
  if (!validate) throw new Error(`Schema was not registered: ${schemaName}`);
  const valid = validate(JSON.parse(fs.readFileSync(dataPath, 'utf8')));
  if (!valid) {
    failed = true;
    console.error(`INVALID ${path.relative(root, dataPath)} (${schemaName})`);
    for (const error of validate.errors || []) {
      console.error(`  ${error.instancePath || '/'}: ${error.message}`);
    }
  }
}

if (failed) process.exit(1);
console.log(`JSON Schema validation passed: ${checks.length} data files`);
