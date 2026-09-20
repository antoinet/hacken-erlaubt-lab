#!/usr/bin/env node
'use strict';
/**
 * Pre-flight check for the training scenario.
 *
 *   node tools/verify.js                   # offline: data + attack chain
 *   node tools/verify.js --url <basis>     # additionally probe the web app
 *   node tools/verify.js --decoys <host>   # additionally probe the decoys
 *   node tools/verify.js --board <url>     # additionally probe the flag check
 *
 * Run the remote check against the Netlify deployment before every workshop:
 * it confirms that the three discoverable artefacts really are reachable and
 * that unknown paths still return 404 (otherwise gobuster reports wildcards
 * and the exercise falls apart).
 */
const crypto = require('crypto');
const net = require('net');
const { MITARBEITER, FLAGS } = require('../lib/data');
const { handleApi } = require('../lib/api');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// --- 1. Every stored hash really is md5(cleartext) -----------------------
for (const m of MITARBEITER) {
  const expected = crypto.createHash('md5').update(m._cleartext).digest('hex');
  check(`hash ${m.benutzername}`, expected === m.passwort_md5, m.passwort_md5);
}

// --- 2. The attack chain end to end --------------------------------------
const post = (path, payload) =>
  handleApi({ method: 'POST', path, body: JSON.stringify(payload) });
const get = (path, token) =>
  handleApi({ path, headers: token ? { authorization: `Bearer ${token}` } : {} });

const svc = post('login', { benutzername: 'dispo_ro', passwort: 'Sommerloch2019!' });
check('stage 3: login with leaked .env credentials', svc.status === 200);
const svcToken = svc.status === 200 ? JSON.parse(svc.body).token : null;

check('stage 3: flag returned on login', svc.body.includes(FLAGS.stage3));
check('portal requires a session', get('tabellen').status === 401);

const dump = get('export/hashes', svcToken);
check(
  'stage 4: hash export contains every account',
  MITARBEITER.every((m) => dump.body.includes(`${m.benutzername}:${m.passwort_md5}`))
);

const staff = get('tabelle/mitarbeiter', svcToken);
check('cleartext passwords are never exposed by the API',
  !MITARBEITER.some((m) => staff.body.includes(m._cleartext)));

check('service account cannot reach the admin area', get('admin', svcToken).status === 403);

const admin = post('login', { benutzername: 's.brunner', passwort: 'trustno1' });
check('stage 4: cracked password logs in as admin', admin.status === 200);
const adminToken = admin.status === 200 ? JSON.parse(admin.body).token : null;
const adminView = get('admin', adminToken);
check('stage 4: final flag reachable', adminView.status === 200 && adminView.body.includes(FLAGS.stage4));

check('wrong password is rejected', post('login', { benutzername: 's.brunner', passwort: 'falsch' }).status === 401);
check('forged token is rejected', get('admin', 'eyJhIjoxfQ.deadbeef').status === 401);

// --- 3. Optional: probe a live deployment --------------------------------
const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] || '' : null;
};

const baseUrl = (argValue('--url') || '').replace(/\/+$/, '') || null;
const decoyHost = argValue('--decoys');
const boardUrl = (argValue('--board') || '').replace(/\/+$/, '') || null;

async function probe() {
  const expect = [
    ['/', 200],
    ['/robots.txt', 200],
    ['/.env', 200],
    ['/backup/', 200],
    ['/intranet/', 200],
    [`/diese-seite-gibt-es-nicht-${Date.now()}`, 404],
  ];
  for (const [path, status] of expect) {
    try {
      const res = await fetch(baseUrl + path, { redirect: 'follow' });
      check(`GET ${path} -> ${status}`, res.status === status, `got ${res.status}`);
      if (path === '/.env') {
        const body = await res.text();
        check('/.env leaks the portal credentials', body.includes('Sommerloch2019!'));
        check('/.env carries flag 2', body.includes(FLAGS.stage2));
      }
    } catch (err) {
      check(`GET ${path}`, false, err.message);
    }
  }

  try {
    const login = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ benutzername: 'dispo_ro', passwort: 'Sommerloch2019!' }),
    });
    check('POST /api/login works on the deployment', login.status === 200, `got ${login.status}`);
  } catch (err) {
    // An unreachable host is the most likely thing this script ever meets
    // (firewall, wrong port, container not started). Report it as a failed
    // check like any other — never as an unhandled rejection.
    check('POST /api/login works on the deployment', false, err.message);
  }
}

/**
 * Connect to a decoy port and return whatever it says within a short window.
 * Redis stays silent until spoken to, so a probe string can be sent first.
 */
function grabBanner(host, port, send) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    let buffer = Buffer.alloc(0);
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(4000, () => done(buffer.toString('latin1')));
    socket.on('connect', () => {
      if (send) setTimeout(() => socket.write(send), 100);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
    });
    socket.on('close', () => done(buffer.toString('latin1')));
    socket.on('error', (err) => done(`ERROR: ${err.message}`));
    setTimeout(() => done(buffer.toString('latin1')), 1500);
  });
}

async function probeDecoys() {
  const expectations = [
    [2222, null, 'SSH-2.0-OpenSSH', 'ssh banner'],
    [3306, null, 'mysql_native_password', 'mysql greeting'],
    [6379, 'PING\r\n', '+PONG', 'redis replies to PING'],
    [6379, '*1\r\n$4\r\ninfo\r\n', 'redis_version:', "redis answers nmap's INFO probe"],
    [9999, null, FLAGS.stage1, 'gateway banner carries flag 1'],
  ];
  for (const [port, send, needle, label] of expectations) {
    const banner = await grabBanner(decoyHost, port, send);
    check(`${label} (port ${port})`, banner.includes(needle), banner.slice(0, 60).replace(/[\r\n]+/g, ' '));
  }
  const gateway = await grabBanner(decoyHost, 9999, null);
  check('gateway banner points at the web port', /Port \d+/.test(gateway));
}

/**
 * Register a throwaway participant, submit a flag, read the dashboard, then
 * delete the participant again so the scoreboard is empty for the workshop.
 */
async function probeBoard() {
  const name = `selbsttest-${Date.now().toString().slice(-6)}`;
  let token = null;
  try {
    const register = await fetch(`${boardUrl}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await register.json();
    token = body.token;
    check('flag check accepts a registration', register.status === 200 && Boolean(token));

    const submit = await fetch(`${boardUrl}/api/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ flag: ` ${FLAGS.stage1.toUpperCase()} ` }),
    });
    const result = await submit.json();
    check('flag check accepts a correct flag (case/space tolerant)', result.korrekt === true && result.stufe === 1);

    const wrong = await fetch(`${boardUrl}/api/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ flag: 'HACKEN-ERLAUBT{falsch}' }),
    });
    check('flag check rejects a wrong flag', (await wrong.json()).korrekt === false);

    const dashboard = await fetch(`${boardUrl}/api/dashboard`);
    const board = await dashboard.json();
    check('dashboard lists all four stages', Array.isArray(board.stufen) && board.stufen.length === 4);
    check(
      'dashboard never ships a flag to the browser',
      !JSON.stringify(board).includes('HACKEN-ERLAUBT{')
    );

    const page = await (await fetch(`${boardUrl}/app.js`)).text();
    check('client code contains no flag values', !Object.values(FLAGS).some((f) => page.includes(f)));
  } catch (err) {
    check('flag check reachable', false, err.message);
  } finally {
    if (token) {
      await fetch(`${boardUrl}/api/me`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }
}

(async () => {
  if (boardUrl) {
    console.log(`\nProbing flag check at ${boardUrl}`);
    await probeBoard();
  }
  if (decoyHost) {
    console.log(`\nProbing decoy services on ${decoyHost}`);
    await probeDecoys();
  }
  if (baseUrl) {
    console.log(`\nProbing deployment at ${baseUrl}`);
    await probe();
  }
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
