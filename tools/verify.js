#!/usr/bin/env node
'use strict';
/**
 * Pre-flight check for the training scenario.
 *
 *   node tools/verify.js                 # offline: data + attack chain
 *   node tools/verify.js --url <basis>   # additionally probe a deployment
 *
 * Run the remote check against the Netlify deployment before every workshop:
 * it confirms that the three discoverable artefacts really are reachable and
 * that unknown paths still return 404 (otherwise gobuster reports wildcards
 * and the exercise falls apart).
 */
const crypto = require('crypto');
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
check('stage 2: login with leaked .env credentials', svc.status === 200);
const svcToken = svc.status === 200 ? JSON.parse(svc.body).token : null;

check('stage 2: flag returned on login', svc.body.includes(FLAGS.stage2));
check('portal requires a session', get('tabellen').status === 401);

const dump = get('export/hashes', svcToken);
check(
  'stage 3: hash export contains every account',
  MITARBEITER.every((m) => dump.body.includes(`${m.benutzername}:${m.passwort_md5}`))
);

const staff = get('tabelle/mitarbeiter', svcToken);
check('cleartext passwords are never exposed by the API',
  !MITARBEITER.some((m) => staff.body.includes(m._cleartext)));

check('service account cannot reach the admin area', get('admin', svcToken).status === 403);

const admin = post('login', { benutzername: 's.brunner', passwort: 'trustno1' });
check('stage 3: cracked password logs in as admin', admin.status === 200);
const adminToken = admin.status === 200 ? JSON.parse(admin.body).token : null;
const adminView = get('admin', adminToken);
check('stage 3: final flag reachable', adminView.status === 200 && adminView.body.includes(FLAGS.stage3));

check('wrong password is rejected', post('login', { benutzername: 's.brunner', passwort: 'falsch' }).status === 401);
check('forged token is rejected', get('admin', 'eyJhIjoxfQ.deadbeef').status === 401);

// --- 3. Optional: probe a live deployment --------------------------------
const urlIndex = process.argv.indexOf('--url');
const baseUrl = urlIndex !== -1 ? (process.argv[urlIndex + 1] || '').replace(/\/+$/, '') : null;

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
        check('/.env carries flag 1', body.includes(FLAGS.stage1));
      }
    } catch (err) {
      check(`GET ${path}`, false, err.message);
    }
  }

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ benutzername: 'dispo_ro', passwort: 'Sommerloch2019!' }),
  });
  check('POST /api/login works on the deployment', login.status === 200, `got ${login.status}`);
}

(async () => {
  if (baseUrl) {
    console.log(`\nProbing deployment at ${baseUrl}`);
    await probe();
  }
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
