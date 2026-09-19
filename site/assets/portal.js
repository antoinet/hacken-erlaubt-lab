/* Shared client helpers for the Dispo-Portal.
   The portal talks to /api/*, which is served by a Netlify Function in the
   hosted deployment and by server/server.js when self-hosted. */

var SESSION_KEY = 'velorapid.session';

function saveSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/** fetch() wrapper: adds the bearer token, unwraps JSON, throws on errors. */
async function api(path, opts) {
  opts = opts || {};
  var session = loadSession();
  var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  if (session && session.token) headers.authorization = 'Bearer ' + session.token;

  var res = await fetch(path, Object.assign({}, opts, { headers: headers }));
  var raw = await res.text();
  var body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    body = raw;
  }
  if (!res.ok) {
    var message = body && body.fehler ? body.fehler : 'Fehler ' + res.status;
    var err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Send the user back to the login page unless a session exists. */
function requireSession() {
  var session = loadSession();
  if (!session || !session.token) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render {spalten, zeilen} as an HTML table. */
function renderTable(spalten, zeilen) {
  var head = spalten.map(function (s) { return '<th>' + esc(s) + '</th>'; }).join('');
  var rows = zeilen.map(function (row) {
    return '<tr>' + spalten.map(function (s) {
      var cell = esc(row[s]);
      if (s === 'passwort_md5') cell = '<span class="mono">' + cell + '</span>';
      return '<td>' + cell + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}
