/* Presenter view: who has found which flag. Polls; no interaction needed. */

var INTERVALL_MS = 3000;

function esc(wert) {
  return String(wert == null ? '' : wert)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * One tile per stage: the count is the headline, the meter shows it against
 * the room. Magnitude, so a single hue — the number is what people read.
 */
function zeichneKpis(daten) {
  var gesamt = daten.teilnehmende.length;
  document.getElementById('kpis').innerHTML = daten.stufen.map(function (stufe, i) {
    var geloest = daten.geloest[i];
    var anteil = gesamt ? Math.round((geloest / gesamt) * 100) : 0;
    return '<div class="kpi">' +
      '<div class="zahl">' + geloest + ' <span style="font-size:16px;color:var(--text-muted)">/ ' + gesamt + '</span></div>' +
      '<div class="titel">' + stufe.nr + '. ' + esc(stufe.titel) + '</div>' +
      '<div class="werkzeug">' + esc(stufe.werkzeug) + '</div>' +
      '<div class="meter" role="img" aria-label="' + geloest + ' von ' + gesamt + ' haben Stufe ' + stufe.nr + ' gefunden">' +
        '<span style="width:' + anteil + '%"></span></div>' +
    '</div>';
  }).join('');
}

function zeichneTabelle(daten) {
  var ziel = document.getElementById('tabelle');
  if (!daten.teilnehmende.length) {
    ziel.innerHTML = '<p class="leer">Noch niemand angemeldet. ' +
      'Teilnehmende öffnen die Startseite dieses Servers und tragen einen Namen ein.</p>';
    return;
  }

  var kopf = '<tr><th>Name</th>' + daten.stufen.map(function (stufe) {
    return '<th class="stufe-kopf">' + stufe.nr + '. ' + esc(stufe.titel) + '</th>';
  }).join('') + '<th class="stufe-kopf">Total</th></tr>';

  var zeilen = daten.teilnehmende.map(function (t) {
    var zellen = t.gefunden.map(function (gefunden, i) {
      // Status never by colour alone: glyph + word, plus a title for hover.
      var klasse = gefunden ? 'ja' : 'nein';
      var wort = gefunden ? 'gefunden' : 'offen';
      return '<td class="zelle"><span class="status ' + klasse + '" title="' +
        esc(t.name) + ' – Stufe ' + daten.stufen[i].nr + ': ' + wort + '">' +
        '<span class="glyph" aria-hidden="true">' + (gefunden ? '✓' : '') + '</span>' +
        wort + '</span></td>';
    }).join('');
    var summe = t.gefunden.filter(Boolean).length;
    return '<tr><td>' + esc(t.name) + '</td>' + zellen +
      '<td class="zelle" style="font-variant-numeric:tabular-nums">' + summe + ' / ' + t.gefunden.length + '</td></tr>';
  }).join('');

  ziel.innerHTML = '<table class="matrix"><thead>' + kopf + '</thead><tbody>' + zeilen + '</tbody></table>';
}

async function aktualisieren() {
  try {
    var res = await fetch('/api/dashboard', { cache: 'no-store' });
    var daten = await res.json();
    zeichneKpis(daten);
    zeichneTabelle(daten);
    var n = daten.teilnehmende.length;
    document.getElementById('anzahl').textContent =
      n === 1 ? '1 Teilnehmer/in' : n + ' Teilnehmende';
  } catch (err) {
    /* Netz weg: letzte Ansicht stehen lassen, beim nächsten Mal neu versuchen. */
  }
}

aktualisieren();
setInterval(aktualisieren, INTERVALL_MS);
