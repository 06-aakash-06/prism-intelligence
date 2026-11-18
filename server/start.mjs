import express from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createApi } from './api.mjs';
import { appRoot } from '../scripts/storage.mjs';

const dist = resolve(appRoot, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Build PRISM first with npm run build.');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const app = express();
const { api, close } = createApi();
app.disable('x-powered-by');
app.use('/api', api);
app.use(express.static(dist, { index: false }));
app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
const server = app.listen(port, host, () => console.log('PRISM Intelligence running at http://' + host + ':' + port));
server.on('close', close);
