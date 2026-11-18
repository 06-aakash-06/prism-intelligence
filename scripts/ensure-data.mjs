import { access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { databasePath, schemaVersion } from './storage.mjs';

let version;
try {
  await access(databasePath);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  version = database.prepare('PRAGMA user_version').get().user_version;
  database.close();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (version !== schemaVersion) await import('./ingest.mjs');
