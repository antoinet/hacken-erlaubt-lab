# Design decisions

Why the training application looks the way it does, including the options that
were rejected. Newest decisions at the bottom.

## 1. One narrative, four stages — not three separate puzzles

The workshop teaches three techniques. Presenting them as three unrelated
exercises makes each one feel like a party trick. Here, each stage produces
the input for the next: the scan yields the web port, enumeration yields
credentials, credentials yield hashes, a cracked hash yields admin. Participants experience the thing that
actually makes attacks dangerous — chaining — rather than three isolated
tools.

The cost: a participant stuck early is stuck everywhere. Mitigated with
staged hints in the hand-out, a banner on port 9999 that names the web port,
a `robots.txt` breadcrumb, and a `/.env` file that spells out which account
the portal uses.

## 2. A small Swiss company, not a CTF box

**Chosen:** a fictional bicycle courier in Zurich with a plausible 2019
website, real-looking dispatch data and a footer that gives away its age.

**Rejected:** an abstract "vulnerable app" with `admin/admin` and lorem ipsum.
The recognition — *this looks like my employer's website* — is what makes the
debrief land. The three mistakes are the ones small businesses actually make.

The company is fictional and labelled as such on every page, the domain uses
the reserved `.example` TLD, and the name was checked against existing Zurich
courier companies.

## 3. Real backend, not a JavaScript-only mock

**Chosen:** credentials are verified server-side (a Netlify Function in the
hosted deployment, a Node server when self-hosted), sessions are HMAC-signed.

**Rejected:** a purely static site checking passwords in JavaScript. It would
run anywhere, but the hashes would sit in the page source — participants could
skip stages 1 and 2 entirely by reading the bundle, and the lesson about
*how* the attacker got in would be lost.

## 4. The same backend runs in both places

All logic lives in `lib/`; `netlify/functions/api.js` and `server/server.js`
are thin adapters. This costs one indirection and buys two things: the hosted
and self-hosted deployments cannot drift apart, and the scenario can move to a
lab VM on a custom port — which is what the nmap module will need
(see [`port-scanning.md`](port-scanning.md)).

No npm dependencies anywhere, so the self-hosted variant runs offline in a VM
image that was built months earlier.

## 5. Unsalted MD5, passwords straight out of rockyou.txt

**Chosen:** MD5 (`hashcat -m 0`) with four of five passwords in
`rockyou.txt`, crackable in seconds on a CPU-only VM.

**Rejected:** rule-based or mask attacks (`best64`, `?u?l?l?l?d?d`) for some
hashes, and a bcrypt hash nobody could crack. Both are better lessons for an
audience that already cracks passwords; for a first contact they turn a
15-minute exercise into a 40-minute one, and a participant whose hash never
falls learns frustration rather than the point.

One deliberate exception: the service account `dispo_ro` uses
`Sommerloch2019!`, which is *not* in `rockyou.txt`. Participants already have
that password from `/.env`, so the un-crackable hash costs them nothing — and
it is the concrete demonstration that the wordlist, not the algorithm, decided
the outcome.

## 6. Only the intended vulnerabilities, everything else solid

Session tokens are HMAC-signed, the database view is read-only with no
free-form SQL input, the self-hosted server blocks path traversal, and the
decoy services have nothing behind them (decision 8). A deliberately
forgeable token or an accidental SQL-injection would let participants skip
the chain, and a traversal bug in a container handed to 20 people is a real
vulnerability rather than a taught one.

The consequence: this app is *not* a general-purpose vulnerable playground
(that is what DVWA and Juice Shop are for). It teaches exactly three
techniques, well.

## 7. Self-hosted target; Netlify only as a preview

**Originally:** Netlify as the workshop target — free, no maintenance, the
same HTTPS URL for everyone — with self-hosting available for the nmap module.

**Revised after testing:** Netlify's abuse protection *blocks* a `gobuster`
client outright, not just throttles it, so the enumeration stage cannot run
there at all. Reducing threads and shrinking the wordlist does not help; the
protection reacts to the request pattern. The workshop target is therefore a
host the organiser controls, and Netlify keeps only a preview role.

This is why `lib/` was kept runtime-agnostic (decision 4): the move cost a
configuration change rather than a rewrite. It also removes the two arguments
that had deferred the nmap module — no custom ports, and a CDN edge that is
not ours to scan. A self-hosted target is ours, and can listen wherever we
like.

## 8. Decoys are banners, and the numbers decided the details

The scanning stage needs services to find, but a public training host must
not run real ones: a genuine Redis or MySQL there would be an actual
vulnerability rather than a taught one. `nmap -sV` identifies a service from
what it says on connect, so a greeting is enough.

Three details were settled by measuring rather than guessing, and each would
silently degrade the exercise if changed back:

- **The web application listens on 8088, not 8443.** nmap assumes TLS on
  8443, reports `https-alt` with no version, and sends participants chasing
  an `https://` URL that cannot work. On 8088 it reports
  `nginx/1.14.0 (Ubuntu)` — the handover stage 2 needs.
- **The gateway on 9999 greets and hangs up.** While it answered every probe
  without matching a fingerprint, `nmap -sV` of that single port took **154
  seconds**; closing after the banner brought the whole five-port scan to
  ~11s. Legacy banner daemons behave that way anyway.
- **Redis sits on 6379 deliberately, which is outside nmap's top-1000.** The
  default scan misses it and `-p-` finds it. That gap is the lesson: "I
  scanned the server" and "I scanned all 65535 ports" are different claims.

**Rejected:** putting the web application on 80 as well, as a safety net for
participants who cannot find it. It would remove the reason to scan at all.
The fallback is gentler instead — the banner on 9999 names the web port, so a
single `nc` unsticks anyone who is lost.

## 9. The flag check is a separate service on port 80

**Chosen:** its own process, its own port, its own visual identity (dark,
"Hacken erlaubt", nothing VeloRapid about it).

**Rejected:** a `/ctf/` path inside the target application. `gobuster` would
have found it mid-exercise, it breaks the fiction of a 2019 courier website,
and it puts a scoreboard endpoint inside the app participants are attacking.

Port 80 specifically, so participants type nothing but the IP — one fewer
thing to mistype in a room already juggling ports — and so the target keeps
8088 to itself. The cost is one extra open port in stage 1's scan, which is
acceptable because the page is self-evidently workshop tooling and tells
participants the target runs elsewhere. That doubles as a safety net for
anyone who cannot find 8088.

**No accounts, but tokens.** A name buys a random token that the browser
keeps; submissions carry it. Not authentication — it stops two people called
"Max" from overwriting each other and survives a reload. The trade-off is
explicit: a cleared browser means a new name, which is the right price for a
two-hour workshop with no sign-up.

Flags are validated server-side against `lib/data.js`, so no flag value ever
reaches the browser — otherwise reading the scoreboard's own JavaScript would
be a shortcut past the entire exercise. `tools/verify.js --board` asserts it
on every deployment.

**Storage is a JSON file in a Docker volume.** Twenty participants and four
booleans do not need a database. Writes are atomic, and if the volume is not
writable the server warns and continues in memory: a scoreboard that forgets
is an annoyance, one that takes the session down is not.

## Open items

- **A sixth account for a second cracking tier.** If a group finishes early, a rule-based or mask
  exercise is the natural extension (see decision 5); it would need a sixth
  account with a password outside `rockyou.txt` but within `best64` reach.
