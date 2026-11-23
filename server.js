import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Only serve explicit public PWA assets; never expose server code, tests, lockfiles, or node_modules.
const PUBLIC_FILES = new Set([
  'index.html',
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
]);

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res) => {
  const file = req.params.file;
  if (!PUBLIC_FILES.has(file)) {
    res.status(404).type('text/plain').send('Not Found');
    return;
  }
  if (file === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache');
  }
  res.sendFile(path.join(__dirname, file));
});

app.use((_req, res) => {
  res.status(404).type('text/plain').send('Not Found');
});

app.listen(PORT, HOST, () => {
  console.log(`DOTBOX server listening on http://${HOST}:${PORT}`);
});
