'use strict';
/**
 * The portal's backend, as one pure function.
 *
 * Both runtimes call this: netlify/functions/api.js (hosted deployment) and
 * server/server.js (self-hosted container). Keeping the logic here is what
 * lets the same scenario run on Netlify today and on a custom port inside a
 * lab VM later, without a second implementation to keep in sync.
 */
const { FLAGS, STAGE_COUNT, MITARBEITER, KUNDEN, AUFTRAEGE } = require('./data');
const { authenticate, issueToken, verifyToken, tokenFromHeaders } = require('./auth');

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const json = (status, payload) => ({
  status,
  headers: JSON_HEADERS,
  body: JSON.stringify(payload, null, 2),
});

const text = (status, payload) => ({
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
  body: payload,
});

/** Staff rows as the portal shows them — hashes included, cleartext never. */
const mitarbeiterRows = () =>
  MITARBEITER.map(({ _cleartext, ...row }) => row); // eslint-disable-line no-unused-vars

const TABELLEN = {
  kunden: {
    label: 'kunden',
    spalten: ['id', 'firma', 'kontakt', 'email', 'telefon', 'plz', 'ort', 'vertrag', 'umsatz_chf'],
    rows: () => KUNDEN,
  },
  auftraege: {
    label: 'auftraege',
    spalten: ['id', 'datum', 'kunde_id', 'abholung', 'ziel', 'kurier', 'status', 'prio', 'preis_chf'],
    rows: () => AUFTRAEGE,
  },
  mitarbeiter: {
    label: 'mitarbeiter',
    spalten: ['id', 'benutzername', 'name', 'rolle', 'email', 'passwort_md5', 'letzter_login'],
    rows: mitarbeiterRows,
  },
};

function requireSession(headers) {
  return verifyToken(tokenFromHeaders(headers));
}

/**
 * @param {object} req
 * @param {string} req.method  HTTP method
 * @param {string} req.path    path below /api, e.g. "login" or "tabelle/kunden"
 * @param {object} req.headers lower-cased header map
 * @param {string} req.body    raw request body
 * @param {object} req.query   parsed query string
 */
function handleApi({ method = 'GET', path = '', headers = {}, body = '', query = {} }) {
  const route = String(path).replace(/^\/+|\/+$/g, '');
  const [head, tail] = route.split('/');

  if (method === 'OPTIONS') return { status: 204, headers: {}, body: '' };

  // --- Stage 3: log in with the credentials leaked through /.env ----------
  if (head === 'login') {
    if (method !== 'POST') return json(405, { fehler: 'Methode nicht erlaubt' });
    let creds;
    try {
      creds = JSON.parse(body || '{}');
    } catch {
      return json(400, { fehler: 'Ungültiger Request-Body' });
    }
    const user = authenticate(creds.benutzername, creds.passwort);
    if (!user) {
      return json(401, { fehler: 'Benutzername oder Passwort falsch' });
    }
    return json(200, {
      token: issueToken(user),
      benutzername: user.benutzername,
      name: user.name,
      rolle: user.rolle,
      flag: FLAGS.stage3,
      stufe: 3,
      stufen: STAGE_COUNT,
    });
  }

  const session = requireSession(headers);
  if (!session) {
    return json(401, { fehler: 'Nicht angemeldet', hinweis: 'Bearer-Token fehlt oder ist abgelaufen' });
  }

  if (head === 'session') {
    return json(200, { benutzername: session.sub, name: session.name, rolle: session.rolle });
  }

  if (head === 'tabellen') {
    return json(200, {
      datenbank: 'velorapid_dispo',
      tabellen: Object.values(TABELLEN).map((t) => ({
        name: t.label,
        zeilen: t.rows().length,
        spalten: t.spalten.length,
      })),
    });
  }

  if (head === 'tabelle') {
    const name = (tail || query.name || '').toLowerCase();
    const tabelle = Object.prototype.hasOwnProperty.call(TABELLEN, name) ? TABELLEN[name] : null;
    if (!tabelle) return json(404, { fehler: `Tabelle '${name}' existiert nicht` });
    return json(200, { name: tabelle.label, spalten: tabelle.spalten, zeilen: tabelle.rows() });
  }

  // --- Stage 4a: the dump that feeds hashcat ------------------------------
  if (head === 'export') {
    const lines = MITARBEITER.map((m) => `${m.benutzername}:${m.passwort_md5}`);
    return text(200, `${lines.join('\n')}\n`);
  }

  // --- Stage 4b: only reachable once a password has actually been cracked -
  if (head === 'admin') {
    if (session.rolle !== 'admin') {
      return json(403, {
        fehler: 'Zugriff verweigert',
        hinweis: `Rolle '${session.rolle}' hat keine Administrationsrechte.`,
      });
    }
    return json(200, {
      flag: FLAGS.stage4,
      stufe: STAGE_COUNT,
      stufen: STAGE_COUNT,
      angemeldet_als: session.sub,
      kennzahlen: {
        kundendatensaetze: KUNDEN.length,
        auftraege_gesamt: AUFTRAEGE.length,
        mitarbeiterkonten: MITARBEITER.length,
        umsatz_chf: KUNDEN.reduce((sum, k) => sum + k.umsatz_chf, 0),
      },
    });
  }

  return json(404, { fehler: 'Unbekannter Endpunkt', pfad: route });
}

module.exports = { handleApi, TABELLEN };
