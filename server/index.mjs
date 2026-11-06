import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist');
const port = Number(process.env.PORT || 5181);
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.woff2':'font/woff2',
  '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml' };
createServer(async (req, res) => {
  const hostname = (req.headers.host ?? '').split(':')[0];
  if (!['127.0.0.1','localhost'].includes(hostname)) { res.writeHead(403).end(); return; }
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  if (req.url === '/api/health') { res.setHeader('Content-Type','application/json'); res.end('{"status":"ok","app":"Motorfolio"}'); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + '\\') && !file.startsWith(root + '/') && file !== root) { res.writeHead(400).end(); return; }
    if (file === root || !(await stat(file).catch(() => null))?.isFile()) file = resolve(root,'index.html');
    res.setHeader('Content-Type',types[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control','no-cache'); res.end(await readFile(file));
  } catch { res.writeHead(500).end('Unable to serve application. Run npm run build.'); }
}).listen(port,'127.0.0.1',() => process.stdout.write(`Motorfolio ready at http://127.0.0.1:${port}\n`));
