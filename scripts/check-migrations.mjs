import fs from 'node:fs';
import path from 'node:path';

const directory = path.resolve('db/migrations');
const files = fs.readdirSync(directory).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
if (!files.length) throw new Error('No ordered SQL migrations found.');
const versions = files.map((file) => Number(file.split('_', 1)[0]));
if (new Set(versions).size !== versions.length || versions.some((version, index) => index > 0 && version <= versions[index - 1])) throw new Error('Migration filenames must have unique, increasing numeric versions.');
for (const file of files) {
  const sql = fs.readFileSync(path.join(directory, file), 'utf8');
  if (!/\bBEGIN\b/i.test(sql) || !/\bCOMMIT\b/i.test(sql)) throw new Error(`${file} must declare an explicit transaction boundary.`);
  if (!/^\s*--\s*compatibility:\s*expand\s*$/im.test(sql)) throw new Error(`${file} must declare '-- compatibility: expand'.`);
  const destructive = [
    /\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|SCHEMA)\b/i,
    /\bTRUNCATE\b/i,
    /\bRENAME\s+(TABLE|COLUMN)\b/i,
    /\bCREATE\s+INDEX\s+CONCURRENTLY\b/i
  ];
  if (destructive.some((pattern) => pattern.test(sql))) throw new Error(`${file} contains a destructive or non-transactional operation; use an expand/contract forward fix.`);
}
console.log(`migration check passed (${files.length} ordered migrations)`);
