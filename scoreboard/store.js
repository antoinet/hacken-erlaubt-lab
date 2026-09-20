'use strict';
/**
 * Participant state for the flag check, persisted as one JSON file.
 *
 * A workshop has twenty participants and four flags; a database would be
 * more machinery than the problem deserves. Writes are atomic (temp file +
 * rename) so a container restart cannot leave a half-written file, and if
 * the disk is not writable the store keeps working in memory rather than
 * taking the session down mid-exercise.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.SCOREBOARD_DATA || path.resolve(__dirname, '..', 'data', 'scoreboard.json');

/** Names are compared case- and whitespace-insensitively so "Anna" == "anna ". */
const keyFor = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');

let state = { teilnehmende: {} };
let persistent = true;

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.teilnehmende) state = parsed;
      console.log(`scoreboard: loaded ${Object.keys(state.teilnehmende).length} participant(s) from ${DATA_FILE}`);
    }
  } catch (err) {
    console.error(`scoreboard: could not read ${DATA_FILE} (${err.message}) — starting empty`);
  }
}

function save() {
  if (!persistent) return;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (err) {
    persistent = false;
    console.error(`scoreboard: cannot persist to ${DATA_FILE} (${err.message}).`);
    console.error('scoreboard: continuing in memory — progress is lost if the container restarts.');
  }
}

/**
 * @returns {{status: 'neu'|'vergeben', teilnehmer?: object}}
 */
function register(name) {
  const key = keyFor(name);
  if (state.teilnehmende[key]) return { status: 'vergeben' };
  const teilnehmer = {
    name: name.trim(),
    token: crypto.randomBytes(16).toString('hex'),
    gefunden: {},
  };
  state.teilnehmende[key] = teilnehmer;
  save();
  return { status: 'neu', teilnehmer };
}

function byToken(token) {
  if (!token) return null;
  return Object.values(state.teilnehmende).find((t) => t.token === token) || null;
}

function markFound(teilnehmer, stage) {
  if (teilnehmer.gefunden[stage]) return false; // already had it
  teilnehmer.gefunden[stage] = true;
  save();
  return true;
}

const alle = () => Object.values(state.teilnehmende);

/** Remove one participant, identified by their own token. */
function entfernen(teilnehmer) {
  const key = Object.keys(state.teilnehmende).find((k) => state.teilnehmende[k] === teilnehmer);
  if (!key) return false;
  delete state.teilnehmende[key];
  save();
  return true;
}

/** Wipe everything — used between groups, never exposed over HTTP. */
function reset() {
  state = { teilnehmende: {} };
  save();
}

load();

module.exports = { register, byToken, markFound, alle, entfernen, reset, DATA_FILE };
