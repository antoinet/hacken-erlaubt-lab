/* Participant side of the flag check: claim a name, submit flags, celebrate. */

var STUFEN = [
  { nr: 1, titel: 'Portscan', werkzeug: 'nmap' },
  { nr: 2, titel: 'Konfigurationsdatei', werkzeug: 'gobuster' },
  { nr: 3, titel: 'Dispo-Portal', werkzeug: 'Zugangsdaten' },
  { nr: 4, titel: 'Passwort geknackt', werkzeug: 'hashcat' },
];

var SPEICHER = 'hacken-erlaubt.teilnehmer';
var teilnehmer = null;

function laden() {
  try {
    return JSON.parse(localStorage.getItem(SPEICHER) || 'null');
  } catch (e) {
    return null;
  }
}

function speichern(daten) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(daten));
  } catch (e) {
    /* Privater Modus: dann gilt der Name nur für diese Seite. */
  }
}

async function api(pfad, optionen) {
  optionen = optionen || {};
  var headers = { 'content-type': 'application/json' };
  if (teilnehmer && teilnehmer.token) headers.authorization = 'Bearer ' + teilnehmer.token;
  var res = await fetch('/api/' + pfad, Object.assign({}, optionen, { headers: headers }));
  var daten = await res.json().catch(function () { return {}; });
  return { ok: res.ok, status: res.status, daten: daten };
}

function zeige(id, klasse, text) {
  var el = document.getElementById(id);
  el.className = 'msg show ' + klasse;
  el.textContent = text;
}

function versteckeMsg(id) {
  document.getElementById(id).className = 'msg';
}

/* --- Stufenliste ------------------------------------------------------- */
function zeichneStufen(fortschritt, frischeStufe) {
  var liste = document.getElementById('stufen');
  liste.innerHTML = '';
  STUFEN.forEach(function (stufe, i) {
    var gefunden = Boolean(fortschritt[i]);
    var li = document.createElement('li');
    li.className = 'stufe' + (frischeStufe === stufe.nr ? ' frisch' : '');
    li.setAttribute('data-gefunden', String(gefunden));
    li.innerHTML =
      '<span class="marke">' + (gefunden ? '&#10003;' : stufe.nr) + '</span>' +
      '<span><span class="titel">' + stufe.titel + '</span><br>' +
      '<span class="werkzeug">' + stufe.werkzeug + '</span></span>';
    liste.appendChild(li);
  });

  var anzahl = fortschritt.filter(Boolean).length;
  document.getElementById('stand').textContent =
    anzahl + ' von ' + STUFEN.length + ' Flags gefunden.';
}

/* --- Konfetti ---------------------------------------------------------- */
var leise = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function konfetti() {
  if (leise) return;
  var canvas = document.getElementById('konfetti');
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var farben = ['#0ca30c', '#3987e5', '#eda100', '#e87ba4', '#ffffff'];
  var teilchen = [];
  for (var i = 0; i < 90; i++) {
    teilchen.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 220,
      y: canvas.height * 0.32,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -11 - 3,
      groesse: 4 + Math.random() * 6,
      drehung: Math.random() * Math.PI,
      dreh: (Math.random() - 0.5) * 0.3,
      farbe: farben[Math.floor(Math.random() * farben.length)],
    });
  }

  var start = performance.now();
  (function rahmen(jetzt) {
    var alter = jetzt - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    teilchen.forEach(function (p) {
      p.vy += 0.32;            // Schwerkraft
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.drehung += p.dreh;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.drehung);
      ctx.globalAlpha = Math.max(0, 1 - alter / 2400);
      ctx.fillStyle = p.farbe;
      ctx.fillRect(-p.groesse / 2, -p.groesse / 2, p.groesse, p.groesse * 0.6);
      ctx.restore();
    });
    if (alter < 2400) {
      requestAnimationFrame(rahmen);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  })(start);
}

/* --- Anmeldung --------------------------------------------------------- */
document.getElementById('anmeldeForm').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var name = document.getElementById('name').value;
  var antwort = await api('register', { method: 'POST', body: JSON.stringify({ name: name }) });
  if (!antwort.ok) {
    zeige('anmeldeMsg', 'err', antwort.daten.fehler || 'Das hat nicht geklappt.');
    return;
  }
  teilnehmer = { name: antwort.daten.name, token: antwort.daten.token };
  speichern(teilnehmer);
  starte(antwort.daten.fortschritt);
});

/* --- Flag pruefen ------------------------------------------------------ */
document.getElementById('flagForm').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var feld = document.getElementById('flag');
  var antwort = await api('flag', { method: 'POST', body: JSON.stringify({ flag: feld.value }) });

  if (antwort.status === 401) {
    localStorage.removeItem(SPEICHER);
    location.reload();
    return;
  }
  if (!antwort.ok) {
    zeige('flagMsg', 'err', antwort.daten.fehler || 'Das hat nicht geklappt.');
    return;
  }

  var daten = antwort.daten;
  if (!daten.korrekt) {
    zeige('flagMsg', 'err', 'Das ist kein gültiges Flag. Nochmal schauen – Tippfehler?');
    feld.classList.remove('ruettel');
    void feld.offsetWidth;            // Neustart der Animation erzwingen
    feld.classList.add('ruettel');
    return;
  }

  if (!daten.neu) {
    zeige('flagMsg', 'info', 'Stufe ' + daten.stufe + ' (' + daten.titel + ') hattest du schon.');
    zeichneStufen(daten.fortschritt);
    return;
  }

  feld.value = '';
  zeige('flagMsg', 'ok', 'Richtig! Stufe ' + daten.stufe + ': ' + daten.titel + ' ✓');
  zeichneStufen(daten.fortschritt, daten.stufe);
  konfetti();

  if (daten.fortschritt.every(Boolean)) {
    setTimeout(function () {
      zeige('flagMsg', 'ok', 'Alle vier Flags gefunden. Sauber gearbeitet! ✓');
      konfetti();
    }, 900);
  }
});

/* --- Start ------------------------------------------------------------- */
function starte(fortschritt) {
  document.getElementById('anmeldung').hidden = true;
  document.getElementById('spiel').hidden = false;
  document.getElementById('wer').textContent = teilnehmer.name;
  versteckeMsg('flagMsg');
  zeichneStufen(fortschritt);
  document.getElementById('flag').focus();
}

(async function () {
  teilnehmer = laden();
  if (teilnehmer && teilnehmer.token) {
    var antwort = await api('status', {});
    if (antwort.ok) {
      teilnehmer.name = antwort.daten.name;
      starte(antwort.daten.fortschritt);
      return;
    }
    localStorage.removeItem(SPEICHER);   // Server neu aufgesetzt
    teilnehmer = null;
  }
  document.getElementById('anmeldung').hidden = false;
  document.getElementById('name').focus();
})();
