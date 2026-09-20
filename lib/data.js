'use strict';
/**
 * Mock dataset for the VeloRapid Zürich GmbH training scenario.
 *
 * EVERYTHING IN HERE IS FICTIONAL. Names, addresses, e-mail addresses and
 * phone numbers are invented for the workshop; the domain velorapid.example
 * uses the reserved .example TLD and resolves nowhere.
 *
 * The password hashes are unsalted MD5 on purpose — that is the lesson of
 * the hashcat exercise, not an oversight.
 */

// Flags participants collect as proof of progress through the four stages.
// Stage 1 is served by decoys/server.js (the port-scanning module); the rest
// by the web application.
const FLAGS = {
  stage1: 'HACKEN-ERLAUBT{offener_port_verraet_dienst}',
  stage2: 'HACKEN-ERLAUBT{env_datei_im_webroot}',
  stage3: 'HACKEN-ERLAUBT{dispo_portal_offen}',
  stage4: 'HACKEN-ERLAUBT{md5_ist_kein_schutz}',
};

const STAGE_COUNT = Object.keys(FLAGS).length;

/**
 * Staff accounts. `passwort_md5` is md5(cleartext); `_cleartext` is kept here
 * only so tools/verify.js can re-derive the hashes and check the exercise
 * still works. It is never serialised into an API response.
 */
const MITARBEITER = [
  {
    id: 1,
    benutzername: 's.brunner',
    name: 'Sandra Brunner',
    rolle: 'admin',
    email: 's.brunner@velorapid.example',
    passwort_md5: '5fcfd41e547a12215b173ff47fdd3739',
    letzter_login: '2019-11-04 08:12:41',
    _cleartext: 'trustno1',
  },
  {
    id: 2,
    benutzername: 'm.keller',
    name: 'Marco Keller',
    rolle: 'disponent',
    email: 'm.keller@velorapid.example',
    passwort_md5: '0571749e2ac330a7455809c6b0e7af90',
    letzter_login: '2019-11-04 07:55:02',
    _cleartext: 'sunshine',
  },
  {
    id: 3,
    benutzername: 'l.fischer',
    name: 'Luca Fischer',
    rolle: 'kurier',
    email: 'l.fischer@velorapid.example',
    passwort_md5: '0d107d09f5bbe40cade3de5c71e9e9b7',
    letzter_login: '2019-11-03 18:40:17',
    _cleartext: 'letmein',
  },
  {
    id: 4,
    benutzername: 'a.moser',
    name: 'Anja Moser',
    rolle: 'buchhaltung',
    email: 'a.moser@velorapid.example',
    passwort_md5: '8afa847f50a716e64932d995c8e7435a',
    letzter_login: '2019-10-31 16:22:58',
    _cleartext: 'princess',
  },
  {
    // The service account whose credentials leak via /.env. Its password is
    // NOT in rockyou.txt — participants already have it, and the hash that
    // refuses to fall is the discussion hook for password strength.
    id: 5,
    benutzername: 'dispo_ro',
    name: 'Service-Account Dispo (read-only)',
    rolle: 'service',
    email: 'it@velorapid.example',
    passwort_md5: '4152e75ef42d9dcd99153295d130f220',
    letzter_login: '2026-09-18 03:00:11',
    _cleartext: 'Sommerloch2019!',
  },
];

const KUNDEN = [
  { id: 101, firma: 'Apotheke Rosengarten',      kontakt: 'R. Ammann',    email: 'bestellung@rosengarten.example',  telefon: '+41 44 201 33 11', plz: '8001', ort: 'Zürich',       vertrag: 'Rahmenvertrag A', umsatz_chf: 18450 },
  { id: 102, firma: 'Kanzlei Waldmann & Partner', kontakt: 'T. Waldmann', email: 'office@waldmann-partner.example', telefon: '+41 44 252 78 90', plz: '8002', ort: 'Zürich',       vertrag: 'Rahmenvertrag B', umsatz_chf: 9320 },
  { id: 103, firma: 'Labor Sihlfeld AG',          kontakt: 'P. Good',     email: 'logistik@sihlfeld-labor.example', telefon: '+41 43 311 04 62', plz: '8003', ort: 'Zürich',       vertrag: 'Express 24/7',    umsatz_chf: 41780 },
  { id: 104, firma: 'Blumen Enge',                kontakt: 'S. Vogt',     email: 'info@blumen-enge.example',        telefon: '+41 44 288 19 07', plz: '8002', ort: 'Zürich',       vertrag: 'Einzelauftrag',   umsatz_chf: 2140 },
  { id: 105, firma: 'Druckerei Hardturm GmbH',    kontakt: 'M. Sialm',    email: 'versand@hardturm-druck.example',  telefon: '+41 44 447 55 21', plz: '8005', ort: 'Zürich',       vertrag: 'Rahmenvertrag A', umsatz_chf: 27600 },
  { id: 106, firma: 'Praxis Dr. Lehmann',         kontakt: 'C. Lehmann',  email: 'praxis@lehmann-med.example',      telefon: '+41 44 380 12 44', plz: '8006', ort: 'Zürich',       vertrag: 'Express 24/7',    umsatz_chf: 15890 },
  { id: 107, firma: 'Weinhandlung Oerlikon',      kontakt: 'B. Steiner',  email: 'kontakt@wein-oerlikon.example',   telefon: '+41 44 311 88 03', plz: '8050', ort: 'Zürich',       vertrag: 'Einzelauftrag',   umsatz_chf: 3870 },
  { id: 108, firma: 'Stadtbüro Altstetten',       kontakt: 'F. Rüegg',    email: 'empfang@stadtbuero-a.example',    telefon: '+41 44 492 61 30', plz: '8048', ort: 'Zürich',       vertrag: 'Rahmenvertrag B', umsatz_chf: 11240 },
];

const AUFTRAEGE = [
  { id: 20451, datum: '2026-09-18 08:14', kunde_id: 103, abholung: 'Sihlfeldstrasse 10, 8003 Zürich', ziel: 'USZ, Rämistrasse 100, 8091 Zürich', kurier: 'l.fischer', status: 'zugestellt',  prio: 'Express', preis_chf: 38.00 },
  { id: 20452, datum: '2026-09-18 08:47', kunde_id: 101, abholung: 'Rosengartenstrasse 42, 8037 Zürich', ziel: 'Alterszentrum Wipkingen, 8037 Zürich', kurier: 'l.fischer', status: 'zugestellt', prio: 'Standard', preis_chf: 19.50 },
  { id: 20453, datum: '2026-09-18 09:02', kunde_id: 102, abholung: 'Bahnhofstrasse 68, 8001 Zürich', ziel: 'Bezirksgericht, Badenerstrasse 90, 8004 Zürich', kurier: 'm.keller', status: 'zugestellt', prio: 'Express', preis_chf: 44.00 },
  { id: 20454, datum: '2026-09-18 10:31', kunde_id: 105, abholung: 'Hardturmstrasse 120, 8005 Zürich', ziel: 'Förrlibuckstrasse 10, 8005 Zürich', kurier: 'l.fischer', status: 'zugestellt', prio: 'Standard', preis_chf: 22.00 },
  { id: 20455, datum: '2026-09-18 11:15', kunde_id: 106, abholung: 'Seefeldstrasse 214, 8008 Zürich', ziel: 'Labor Sihlfeld, 8003 Zürich', kurier: 'm.keller', status: 'zugestellt', prio: 'Express', preis_chf: 41.00 },
  { id: 20456, datum: '2026-09-18 13:40', kunde_id: 107, abholung: 'Schaffhauserstrasse 355, 8050 Zürich', ziel: 'Hotel Rigiblick, 8044 Zürich', kurier: 'l.fischer', status: 'unterwegs',  prio: 'Standard', preis_chf: 26.50 },
  { id: 20457, datum: '2026-09-18 14:05', kunde_id: 108, abholung: 'Hohlstrasse 500, 8048 Zürich', ziel: 'Stadthaus, Stadthausquai 17, 8001 Zürich', kurier: 'm.keller', status: 'unterwegs', prio: 'Express', preis_chf: 39.00 },
  { id: 20458, datum: '2026-09-18 15:22', kunde_id: 104, abholung: 'Seestrasse 41, 8002 Zürich', ziel: 'Privatadresse, 8038 Zürich', kurier: '—', status: 'offen', prio: 'Standard', preis_chf: 21.00 },
  { id: 20459, datum: '2026-09-18 16:03', kunde_id: 103, abholung: 'Sihlfeldstrasse 10, 8003 Zürich', ziel: 'Kantonsspital Winterthur', kurier: '—', status: 'offen', prio: 'Express', preis_chf: 72.00 },
];

module.exports = { FLAGS, STAGE_COUNT, MITARBEITER, KUNDEN, AUFTRAEGE };
