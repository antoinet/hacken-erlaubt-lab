# Scenario and solution

> **Spoilers.** This document contains the full attack chain and every
> credential. The participant-facing version is [`handout-de.md`](handout-de.md).

## The story

*VeloRapid Zürich GmbH* is a fictional bicycle-courier company in Zurich,
founded 2014, 28 employees. In 2019 a freelancer relaunched their website and
moved dispatch into a small web portal. The freelancer is long gone. Nobody
has touched the site since — the footer still says 2019.

Three ordinary mistakes were made, all of which are common in real small
businesses:

1. The application's configuration file was left in the web root, where the
   web server happily serves it to anyone who asks for it by name.
2. The dispatch portal was "secured" by removing its link from the menu.
3. Passwords have been stored as unsalted MD5 since 2014, and the company-wide
   password change was postponed to "Q3" — of 2019.

The participants play an outside attacker who knows nothing but an IP
address. The company's own hosting is equally dated: services nobody
remembers are still listening, and the website runs on a port somebody picked
years ago and never revisited.

## Cast

| Account | Role | Password | Note |
|---|---|---|---|
| `dispo_ro` | service | `Sommerloch2019!` | The database service account; leaks via `/.env`. Its password is **not** in `rockyou.txt`. |
| `s.brunner` | admin | `trustno1` | Sandra Brunner, managing director. The escalation target. |
| `m.keller` | disponent | `sunshine` | |
| `l.fischer` | kurier | `letmein` | |
| `a.moser` | buchhaltung | `princess` | |

Four of the five hashes fall to a straight `rockyou.txt` run. The fifth is the
service account, whose password participants already have from `/.env` — the
hash that refuses to fall is the discussion hook for *why* it resists.

## The chain

```
  nmap -Pn <ip>          ->  2222 ssh, 3306 mysql, 8088 http, 9999 ???
  nc <ip> 9999           ->  gateway banner: web on 8088          STAGE 1
  nmap -Pn -p- <ip>      ->  6379 redis (missed by the default scan)
  GET /robots.txt        ->  Disallow: /backup/   (breadcrumb, not the goal)
  gobuster               ->  /.env        200                     STAGE 2
                         ->  /intranet/   301/200 STAGE 3 target
                         ->  /backup/     200     old page + internal notes
  /.env                  ->  dispo_ro : Sommerloch2019!
  POST /api/login        ->  portal session (role: service)       STAGE 3
  portal > Datenbank     ->  table `mitarbeiter` with MD5 hashes
  hashcat                ->  s.brunner : trustno1
  POST /api/login        ->  portal session (role: admin)         STAGE 4
```

### Flags

| Stage | Flag | Where |
|---|---|---|
| 1 | `HACKEN-ERLAUBT{offener_port_verraet_dienst}` | banner on port 9999 |
| 2 | `HACKEN-ERLAUBT{env_datei_im_webroot}` | last line of `/.env` |
| 3 | `HACKEN-ERLAUBT{dispo_portal_offen}` | portal overview, after logging in |
| 4 | `HACKEN-ERLAUBT{md5_ist_kein_schutz}` | Administration tab, after cracking |

All four are defined in `lib/data.js`; the decoy services import them from
there, so there is one place to change them.

## Walkthrough

### Stage 1 — scan (15 min)

```bash
nmap -Pn <ziel-ip>                                   # top 1000 ports
nmap -sV -Pn -p 2222,3306,8088,9999 <ziel-ip>        # what is running
nc <ziel-ip> 9999                                    # flag 1
nmap -Pn -p- <ziel-ip>                               # finds 6379 as well
```

The default scan reports SSH on 2222, MySQL on 3306, something HTTP-ish on
8088 and an unknown service on 9999. Version detection turns that into a
story: an SSH moved off 22, a database exposed to the internet, nginx 1.14.0
from 2018, and a legacy gateway whose banner hands over the web port — and
flag 1.

The full scan is worth the extra minute: Redis on 6379 is outside nmap's
top-1000 and the default scan never sees it. Details and measured timings in
[`port-scanning.md`](port-scanning.md).

> **Question for the room:** four of these five services are things nobody at
> VeloRapid would say they run. How would the company even know they are
> there?

### Stage 2a — look around (5 min)

```bash
curl -s http://<ziel-ip>:8088/robots.txt
```

`robots.txt` disallows `/backup/`, `/cgi-bin/` and `/tmp/`. `/backup/` exists
and looks like an Apache directory index: an archived 2019 copy of the
homepage and `dispo-notizen.txt`. The notes say the portal link was removed on
purpose and that "the credentials are in the configuration file in the web
root" — a hint towards stage 1 without naming the file.

This is the teaching point that `robots.txt` is a *map*, not a lock.

### Stage 2b — enumeration (15 min)

```bash
gobuster dir -u http://<ziel-ip>:8088 -w tools/workshop-wordlist.txt -t 5 -o gobuster.txt
```

Expected hits: `/.env` (200), `/intranet/` (301 → 200), `/backup/` (200),
`/robots.txt` (200), `/assets/` (301), `/api/` (404/405 — a dead end without a
route, worth a note).

```bash
curl -s http://<ziel-ip>:8088/.env
```

Yields the database block — `DB_USERNAME=dispo_ro`,
`DB_PASSWORD=Sommerloch2019!` — plus `PORTAL_LOGIN_PATH=/intranet/`, a mail
password, an API key and flag 1. The file also states outright that the portal
login uses the database service account, so nobody gets stuck guessing which
of the leaked secrets to try.

### Stage 3 — walk in (10 min)

Open `http://<ziel-ip>:8088/intranet/` and log in as `dispo_ro` /
`Sommerloch2019!`. The dashboard shows dispatch orders, customers and a
read-only database browser. Flag 3 is on the overview tab.

Under **Datenbank → mitarbeiter** the staff table is visible, including
`passwort_md5`. "Hashes exportieren" downloads `velorapid_hashes.txt` in
`username:hash` form. The same thing from the command line:

```bash
TOKEN=$(curl -s http://<ziel-ip>:8088/api/login \
  -H 'content-type: application/json' \
  -d '{"benutzername":"dispo_ro","passwort":"Sommerloch2019!"}' | jq -r .token)

curl -s http://<ziel-ip>:8088/api/export/hashes -H "authorization: Bearer $TOKEN"
```

### Stage 4 — cracking (20 min)

```bash
# rockyou.txt on Kali is shipped compressed:
sudo gunzip -k /usr/share/wordlists/rockyou.txt.gz 2>/dev/null

hashcat -m 0 -a 0 --username velorapid_hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 0 --username --show velorapid_hashes.txt
```

`-m 0` is raw MD5, `-a 0` a straight dictionary attack, `--username` tells
hashcat the file is `username:hash`. On a CPU-only VM this finishes in well
under a minute. John the Ripper works just as well:

```bash
john --format=raw-md5 --wordlist=/usr/share/wordlists/rockyou.txt velorapid_hashes.txt
john --format=raw-md5 --show velorapid_hashes.txt
```

Four accounts fall; `dispo_ro` does not.

Log out of the portal and log back in as `s.brunner` / `trustno1`. The
**Administration** tab appears: business metrics, flag 4, and the debrief —
the five things VeloRapid should have done differently.

## Debrief talking points

1. **Attack surface nobody inventoried.** Every service on that host was
   put there for a reason that expired years ago. You cannot secure what you
   do not know you run; the scan the participants just did is one a defender
   should run against their own estate first.
2. **Secrets in the web root.** `.env` in a published directory is one HTTP
   request away from everyone. Configuration belongs outside the document
   root, and secrets belong in a secret store, not in git.
3. **Security by obscurity.** An unlinked URL is not a secret: a wordlist
   finds `/intranet/` in seconds. Ask the room how many "internal" tools at
   their own workplace are protected only by not being linked.
4. **Shared service accounts.** One account everyone knows, never rotated,
   makes every action unattributable — the portal cannot distinguish the
   dispatcher from the attacker.
5. **Unsalted MD5.** Fast hashes plus common passwords equals instant
   compromise. Today: bcrypt, scrypt or Argon2id, salted, deliberately slow.
   Point at `dispo_ro`: the same algorithm, but the password is not in the
   wordlist — so the *password* bought the time the *algorithm* did not.
6. **Password reuse and no MFA.** Cracking one password walked straight into
   admin. MFA, rate limiting and alerting on failed logins each would have
   broken the chain.

A good closing question: *which single one of these six fixes would have
stopped the attack earliest?* (Keeping `.env` out of the web root — everything
downstream depended on it.)
