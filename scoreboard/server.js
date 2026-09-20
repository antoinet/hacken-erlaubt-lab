#!/usr/bin/env node
'use strict';
/**
 * Flag check and presenter dashboard.
 *
 * Deliberately separate from the target application: it runs on its own port
 * (80 in the workshop deployment, so participants only type the IP), keeps
 * the VeloRapid fiction clean, and gives the scan stage something that is
 * obviously the workshop's own tooling rather than the company's.
 *
 * No passwords: a participant claims a name and gets a token, which the
 * browser keeps. That is not authentication, it just stops two people with
 * the same name from overwriting each other.
 *
 *   node scoreboard/server.js --port 8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { FLAGS } = require('../lib/data');
const store = require('./store');

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const PORT = Number(
  process.argv.includes('--port')
    ? process.argv[process.argv.indexOf('--port') + 1]
    : process.env.PORT || 8080
);

/** The stages, in the order the workshop runs them. */
const STUFEN = [
  { nr: 1, key: 'stage1', titel: 'Portscan', werkzeug: 'nmap' },
  { nr: 2, key: 'stage2', titel: 'Konfigurationsdatei', werkzeug: 'gobuster' },
  { nr: 3, key: 'stage3', titel: 'Dispo-Portal', werkzeug: 'Zugangsdaten' },
  { nr: 4, key: 'stage4', titel: 'Passwort geknackt', werkzeug: 'hashcat' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Which stage does this submission belong to?
 * Lenient about whitespace and case — people retype these off a terminal,
 * and a workshop is no place to lose five minutes to a capital letter.
 */
function stageFor(submitted) {
  const normalised = String(submitted || '').trim().toLowerCase();
  if (!normalised) return null;
  return STUFEN.find((stufe) => FLAGS[stufe.key].toLowerCase() === normalised) || null;
}

const json = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
};

const fortschritt = (teilnehmer) => STUFEN.map((stufe) => Boolean(teilnehmer.gefunden[stufe.key]));

const NAME_PATTERN = /^[\p{L}\p{N} ._-]{2,24}$/u;

function handleApi(req, res, route, body) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (route === 'register' && req.method === 'POST') {
    let name;
    try {
      name = String(JSON.parse(body || '{}').name || '');
    } catch {
      return json(res, 400, { fehler: 'Ungültige Anfrage' });
    }
    if (!NAME_PATTERN.test(name.trim())) {
      return json(res, 400, {
        fehler: 'Name: 2 bis 24 Zeichen, Buchstaben und Ziffern.',
      });
    }
    const result = store.register(name);
    if (result.status === 'vergeben') {
      return json(res, 409, { fehler: 'Dieser Name ist schon vergeben. Wähle einen anderen.' });
    }
    return json(res, 200, {
      name: result.teilnehmer.name,
      token: result.teilnehmer.token,
      fortschritt: fortschritt(result.teilnehmer),
    });
  }

  if (route === 'status' && req.method === 'GET') {
    const teilnehmer = store.byToken(token);
    if (!teilnehmer) return json(res, 401, { fehler: 'Unbekannt' });
    return json(res, 200, { name: teilnehmer.name, fortschritt: fortschritt(teilnehmer) });
  }

  if (route === 'flag' && req.method === 'POST') {
    const teilnehmer = store.byToken(token);
    if (!teilnehmer) return json(res, 401, { fehler: 'Bitte zuerst anmelden.' });
    let eingabe;
    try {
      eingabe = JSON.parse(body || '{}').flag;
    } catch {
      return json(res, 400, { fehler: 'Ungültige Anfrage' });
    }
    const stufe = stageFor(eingabe);
    if (!stufe) {
      return json(res, 200, { korrekt: false, fortschritt: fortschritt(teilnehmer) });
    }
    const neu = store.markFound(teilnehmer, stufe.key);
    return json(res, 200, {
      korrekt: true,
      neu,
      stufe: stufe.nr,
      titel: stufe.titel,
      fortschritt: fortschritt(teilnehmer),
    });
  }

  // Lets the pre-flight check clean up after itself; a participant can only
  // ever remove their own entry with it.
  if (route === 'me' && req.method === 'DELETE') {
    const teilnehmer = store.byToken(token);
    if (!teilnehmer) return json(res, 401, { fehler: 'Unbekannt' });
    store.entfernen(teilnehmer);
    return json(res, 200, { geloescht: true });
  }

  if (route === 'dashboard' && req.method === 'GET') {
    const teilnehmende = store.alle()
      .map((t) => ({ name: t.name, gefunden: fortschritt(t) }))
      .sort((a, b) => {
        const diff = b.gefunden.filter(Boolean).length - a.gefunden.filter(Boolean).length;
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'de');
      });
    return json(res, 200, {
      stufen: STUFEN.map(({ nr, titel, werkzeug }) => ({ nr, titel, werkzeug })),
      teilnehmende,
      geloest: STUFEN.map((_, i) => teilnehmende.filter((t) => t.gefunden[i]).length),
    });
  }

  return json(res, 404, { fehler: 'Unbekannter Endpunkt' });
}

function serveStatic(res, urlPath) {
  const name = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.resolve(PUBLIC_DIR, `.${name}`);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><p>Nicht gefunden. <a href="/">Zur Flag-Eingabe</a></p>');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(fs.readFileSync(file));
}

const server = http.createServer((req, res) => {
  const [urlPath] = req.url.split('?');

  if (urlPath.startsWith('/api/')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => handleApi(req, res, urlPath.slice(5), body));
    return;
  }

  // /dashboard is a nicer thing to type on a projector than /dashboard.html
  serveStatic(res, urlPath === '/dashboard' ? '/dashboard.html' : urlPath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Flag-Check auf http://0.0.0.0:${PORT}  (Dashboard: /dashboard)`);
  console.log(`Daten: ${store.DATA_FILE}`);
});
