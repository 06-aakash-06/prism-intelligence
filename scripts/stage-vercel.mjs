import { createReadStream, createWriteStream } from 'node:fs';
import { access, cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { build } from 'esbuild';
import { appRoot, databasePath, researchRoot } from './storage.mjs';
import { sources } from './sources.mjs';

const reportPath = resolve(researchRoot, sources.report[0]);
await Promise.all([access(databasePath), access(reportPath)]);
const vercel = join(appRoot, '.vercel');
await mkdir(vercel, { recursive: true });
const staging = await mkdtemp(join(vercel, 'staging-'));
const output = join(vercel, 'output');

try {
  const fn = join(staging, 'functions', 'api.func');
  await mkdir(fn, { recursive: true });
  await Promise.all([
    cp(join(appRoot, 'dist'), join(staging, 'static'), { recursive: true }),
    cp(reportPath, join(fn, 'report.pdf')),
    pipeline(createReadStream(databasePath), createGzip({ level: 5 }),
      createWriteStream(join(fn, 'prism.sqlite.gz'), { mode: 0o600 })),
    build({
      entryPoints: [join(appRoot, 'server', 'vercel.mjs')],
      outfile: join(fn, 'index.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
    }),
    writeFile(join(staging, 'config.json'), JSON.stringify({
      version: 3,
      routes: [
        { src: '/api/(.*)', dest: '/api?__prism_path=$1' },
        { handle: 'filesystem' },
        { src: '/.*', dest: '/index.html' },
      ],
    }, null, 2)),
    writeFile(join(fn, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs' })),
  ]);
  const { size } = await stat(join(fn, 'prism.sqlite.gz'));
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  console.log('Prepared protected Vercel output with ' + Math.ceil(size / 1024 / 1024) + ' MiB of compressed evidence.');
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
