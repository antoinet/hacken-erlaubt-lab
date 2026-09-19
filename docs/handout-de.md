# Hacken erlaubt — Übung: Web-Enumeration & Passwort-Cracking

**Ziel:** https://__ZIEL-URL-EINSETZEN__

## Spielregeln

- Angriffe sind **ausschliesslich** gegen die oben genannte Adresse erlaubt.
  Alles andere ist nicht Teil der Übung — und ausserhalb dieses Kurses
  strafbar (Art. 143bis StGB, unbefugtes Eindringen in ein
  Datenverarbeitungssystem).
- Bitte mit `-t 5` scannen. Leise ist besser: Wer laut scannt, fliegt auf.
- Die Firma, alle Personen und alle Daten in dieser Umgebung sind erfunden.

## Die Ausgangslage

Die *VeloRapid Zürich GmbH* ist ein Velokurierdienst in Zürich. Ihre Website
wurde 2019 von einem Freelancer aufgesetzt und seither nicht mehr angefasst.
Sie haben nichts als die Adresse.

Ihre Aufgabe: Finden Sie heraus, wie weit Sie kommen — und sammeln Sie
unterwegs drei Flags im Format `HACKEN-ERLAUBT{...}`.

---

## Aufgabe 1 — Umschauen

Verschaffen Sie sich einen Überblick. Was verrät die Website über sich selbst,
ohne dass man etwas «hacken» muss?

```bash
curl -s https://__ZIEL-URL__/robots.txt
```

> **Frage:** `robots.txt` sagt Suchmaschinen, was sie *nicht* indexieren
> sollen. Schützt das etwas?

---

## Aufgabe 2 — Verzeichnisse und Dateien finden (gobuster)

Nicht alles, was auf einem Webserver liegt, ist verlinkt. `gobuster` probiert
Pfade aus einer Wortliste durch und zeigt, was tatsächlich existiert.

```bash
gobuster dir -u https://__ZIEL-URL__ \
             -w workshop-wordlist.txt \
             -t 5 \
             -o gobuster-ergebnis.txt
```

Was bedeuten die Statuscodes?

| Code | Bedeutung |
|---|---|
| 200 | Existiert und wird ausgeliefert |
| 301 / 302 | Weiterleitung — meistens ein Verzeichnis |
| 403 | Existiert, aber Zugriff verweigert — trotzdem eine Information! |
| 404 | Nicht vorhanden |

**Ziel dieser Aufgabe:** eine Datei mit Zugangsdaten und ein nicht verlinkter
interner Bereich.

<details>
<summary>Hinweis 1</summary>

Anwendungen legen ihre Konfiguration oft in einer Datei ab, deren Name mit
einem Punkt beginnt. Sie gehört nicht ins Webverzeichnis — liegt aber
erstaunlich oft dort.
</details>

<details>
<summary>Hinweis 2</summary>

Sehen Sie sich den Fund mit `curl` an, nicht nur im Browser:
`curl -s https://__ZIEL-URL__/<fund>`
</details>

**Flag 1:** `HACKEN-ERLAUBT{________________}`

---

## Aufgabe 3 — Einloggen

Der interne Bereich ist über eine normale Anmeldemaske geschützt. Sie haben
aus Aufgabe 2 alles, was Sie dafür brauchen.

<details>
<summary>Hinweis</summary>

Die Anmeldeseite sagt selbst, welches Konto sie verwendet. Lesen Sie den
Hinweistext unter dem Formular.
</details>

Sehen Sie sich im Portal um: Aufträge, Kunden — und den Reiter **Datenbank**.

**Flag 2:** `HACKEN-ERLAUBT{________________}`

> **Frage:** Wie viele Personendaten könnten Sie an dieser Stelle bereits
> abziehen? Was wäre das für die Firma — und für deren Kundschaft?

---

## Aufgabe 4 — Passwörter knacken (hashcat)

In der Tabelle `mitarbeiter` stehen keine Passwörter, sondern **Hashes**: das
Ergebnis einer Einwegfunktion. Man kann sie nicht «zurückrechnen» — aber man
kann raten, hashen und vergleichen. Genau das macht `hashcat`.

Exportieren Sie die Hashes («Hashes exportieren») und knacken Sie sie:

```bash
# rockyou.txt ist auf Kali komprimiert ausgeliefert:
sudo gunzip -k /usr/share/wordlists/rockyou.txt.gz

hashcat -m 0 -a 0 --username velorapid_hashes.txt /usr/share/wordlists/rockyou.txt

# Ergebnisse noch einmal anzeigen:
hashcat -m 0 --username --show velorapid_hashes.txt
```

| Option | Bedeutung |
|---|---|
| `-m 0` | Hash-Typ: MD5 |
| `-a 0` | Angriffsart: Wörterbuchangriff |
| `--username` | Die Datei hat das Format `benutzername:hash` |

`rockyou.txt` enthält rund 14 Millionen Passwörter aus einem echten Leak von
2009. Vier der fünf Konten fallen damit. Eines nicht — überlegen Sie sich,
warum.

---

## Aufgabe 5 — Weiterkommen

Eines der geknackten Konten hat mehr Rechte als das Konto, mit dem Sie
angemeldet sind. Melden Sie sich ab und mit diesem Konto neu an.

**Flag 3:** `HACKEN-ERLAUBT{________________}`

---

## Zum Schluss: die Gegenseite

Notieren Sie sich während der Übung, an welchen fünf Stellen VeloRapid den
Angriff hätte stoppen können. Wir vergleichen die Listen in der
Schlussbesprechung.

1. ________________________________________________
2. ________________________________________________
3. ________________________________________________
4. ________________________________________________
5. ________________________________________________

> **Die entscheidende Frage:** Welche *eine* dieser Massnahmen hätte den
> Angriff am frühesten beendet?
