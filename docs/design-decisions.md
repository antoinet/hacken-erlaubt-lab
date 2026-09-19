# Design decisions

Why the training application looks the way it does, including the options that
were rejected. Newest decisions at the bottom.

## 1. One narrative, three stages — not three separate puzzles

The workshop teaches three techniques. Presenting them as three unrelated
exercises makes each one feel like a party trick. Here, each stage produces
the input for the next: enumeration yields credentials, credentials yield
hashes, a cracked hash yields admin. Participants experience the thing that
actually makes attacks dangerous — chaining — rather than three isolated
tools.

The cost: a participant stuck at stage 1 is stuck everywhere. Mitigated with
staged hints in the hand-out, a `robots.txt` breadcrumb, and a `/.env` file
that spells out which account the portal uses.

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

## 6. Only three vulnerabilities, everything else solid

Session tokens are HMAC-signed, the database view is read-only with no
free-form SQL input, and the self-hosted server blocks path traversal. A
deliberately forgeable token or an accidental SQL-injection would let
participants skip the chain, and a traversal bug in a container handed to 20
people is a real vulnerability rather than a taught one.

The consequence: this app is *not* a general-purpose vulnerable playground
(that is what DVWA and Juice Shop are for). It teaches exactly three
techniques, well.

## 7. Netlify now, self-hosting available

Netlify is free, needs no maintenance, and gives every participant the same
target over plain HTTPS. Its limits are accepted knowingly: no custom ports
(hence no nmap module), and a shared CDN edge that must not be port-scanned.

The gobuster exercise puts measurable load on that edge — see the rate-limit
section in [`facilitator-guide.md`](facilitator-guide.md). The supplied
~190-entry wordlist and `-t 5` keep a 20-person class well inside sane
volumes; if it ever becomes a problem, the same scenario runs from a local
container.

## Open items

- **nmap module.** Deferred, with a recommendation and an open question about
  ordering — see [`port-scanning.md`](port-scanning.md).
- **Flag collection.** Flags are currently written down by hand. A scoreboard
  would show the facilitator who is stuck, at the price of a stateful backend
  that Netlify Functions alone cannot provide.
- **Second cracking tier.** If a group finishes early, a rule-based or mask
  exercise is the natural extension (see decision 5); it would need a sixth
  account with a password outside `rockyou.txt` but within `best64` reach.
