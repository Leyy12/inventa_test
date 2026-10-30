// Local development server: `npm run dev` → http://localhost:3000
// Loads .env, serves the POS pages, and runs the same /api functions Vercel runs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env loader (KEY=value, # comments, optional quotes). Real env vars win.
function loadEnv(file) {
  if (!fs.existsSync(file)) return false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
  return true;
}
const envFound = loadEnv(path.join(root, '.env.local')) | loadEnv(path.join(root, '.env'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/\/+$/, '');
      if (!/^[a-z-]+$/.test(name)) { res.statusCode = 404; return res.end('Not found'); }
      const file = path.join(root, 'api', `${name}.js`);
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    // Static files. Block anything that is not part of the website.
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(root, rel));
    const allowed = ['index.html', 'css', 'js', 'pages', 'favicon.ico'].some(p => file === path.join(root, p) || file.startsWith(path.join(root, p) + path.sep));
    if (!file.startsWith(root) || !allowed || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404; return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.statusCode = 500; res.end('Server error'); }
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`QuickPOS running at http://localhost:${port}`);
  console.log(envFound ? 'Loaded settings from .env' : 'No .env found — copy .env.example to .env and add your API key.');
  console.log(`InventaAPI key: ${process.env.INVENTA_API_KEY ? 'set' : 'NOT set'} · Storage: ${process.env.SUPABASE_URL ? 'Supabase' : 'local file (.data/)'}`);
});
