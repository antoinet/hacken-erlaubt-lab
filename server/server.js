#!/usr/bin/env node
'use strict';
/**
 * Self-hosted runtime: serves site/ plus the /api routes from lib/api.js,
 * with no npm dependencies so it runs offline inside a lab VM.
 *
 * Why this exists next to the Netlify deployment: Netlify only ever answers
 * on 443, which makes a port-scanning exercise pointless. This server binds
 * to whatever port you give it, so the same scenario can sit behind an odd
 * port (see docker-compose.yml) once the nmap module gets built.
 *
 *   node server/server.js --port 8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi } = require('../lib/api');

const SITE_ROOT = path.resolve(__dirname, '..', 'site');
const PORT = Number(
  process.argv.includes('--port')
    ? process.argv[process.argv.indexOf('--port') + 1]
    : process.env.PORT || 8080
);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.env': 'text/plain; charset=utf-8',
};

/**
 * Resolve a URL path to a file inside SITE_ROOT.
 * Returns null for anything that escapes the root — the directory traversal
 * this prevents is a real vulnerability, not one of the three the workshop
 * is teaching, and it would expose the container's filesystem.
 */
function resolveStatic(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = path.resolve(SITE_ROOT, `.${path.posix.normalize(decoded)}`);
  if (candidate !== SITE_ROOT && !candidate.startsWith(SITE_ROOT + path.sep)) return null;

  let file = candidate;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

function send(res, status, headers, body) {
  res.writeHead(status, { 'x-robots-tag': 'noindex, nofollow', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const [urlPath] = req.url.split('?');
  const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      const result = handleApi({
        method: req.method,
        path: urlPath.slice('/api'.length),
        headers: req.headers,
        body,
        query,
      });
      send(res, result.status, { ...result.headers, 'cache-control': 'no-store' }, result.body);
    });
    return;
  }

  // Directories keep their trailing slash, matching Netlify's behaviour so
  // gobuster output looks the same in both deployments.
  if (
    !urlPath.endsWith('/') &&
    fs.existsSync(path.join(SITE_ROOT, urlPath)) &&
    fs.statSync(path.join(SITE_ROOT, urlPath)).isDirectory()
  ) {
    return send(res, 301, { location: `${urlPath}/` }, '');
  }

  const file = resolveStatic(urlPath);
  if (!file) {
    const notFound = path.join(SITE_ROOT, '404.html');
    const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not Found';
    return send(res, 404, { 'content-type': 'text/html; charset=utf-8' }, body);
  }

  const type = MIME[path.extname(file) || path.basename(file)] || 'application/octet-stream';
  send(res, 200, { 'content-type': type }, fs.readFileSync(file));
});

server.listen(PORT, HOST, () => {
  console.log(`VeloRapid training app (intentionally vulnerable) on http://${HOST}:${PORT}`);
});
