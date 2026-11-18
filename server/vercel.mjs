import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import express from 'express';
import { createApi } from './api.mjs';

async function initialize() {
  const directory = await mkdtemp(join(tmpdir(), 'prism-'));
  const database = join(directory, 'prism.sqlite');
  try {
    await pipeline(createReadStream(new URL('./prism.sqlite.gz', import.meta.url)),
      createGunzip(), createWriteStream(database, { mode: 0o600 }));
    const report = fileURLToPath(new URL('./report.pdf', import.meta.url));
    const { api } = createApi(database, report);
    const app = express();
    app.disable('x-powered-by');
    app.use('/api', api);
    return app;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

let startup;
export default async function handler(req, res) {
  try {
    const app = await (startup ??= initialize().catch(error => {
      startup = undefined;
      throw error;
    }));
    // The Build Output route carries the original API subpath through the rewrite.
    const url = new URL(req.url, 'http://localhost');
    const subpath = url.searchParams.get('__prism_path');
    if (subpath !== null) {
      url.searchParams.delete('__prism_path');
      req.url = '/api/' + subpath + url.search;
    }
    app(req, res);
  } catch (error) {
    console.error('PRISM evidence failed to initialize', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'The hosted evidence could not be loaded.' }));
  }
}
