# Facilitator guide

Everything needed to run the web-enumeration and password-cracking blocks of
the workshop. For the attack chain itself see [`scenario.md`](scenario.md).

## Before the session

### 1. Deploy and verify

```bash
node tools/verify.js --url https://<your-site>.netlify.app
```

All checks must pass. The two that matter most:

- **`/.env` returns 200 with the credentials.** If it 404s, the dotfile did
  not survive the deploy — the `netlify.toml` rewrite from `/.env` to
  `/_leak/env.txt` is what makes this robust, so check that `netlify.toml` was
  picked up.
- **An unknown path returns 404.** If a catch-all returns 200, `gobuster`
  reports every word as a hit and the exercise is dead.

### 2. Check the participant VMs

| Needed | Check |
|---|---|
| `gobuster` | `gobuster version` |
| `hashcat` (or `john`) | `hashcat --version` |
| `rockyou.txt` | `ls /usr/share/wordlists/rockyou.txt*` — on Kali it ships as `.gz`; `sudo gunzip -k /usr/share/wordlists/rockyou.txt.gz` |
| The wordlist | copy `tools/workshop-wordlist.txt` into the VM image |
| Outbound HTTPS | `curl -sI https://<your-site>.netlify.app` |

Do this **in the VM image**, not live in front of the room. A missing
`rockyou.txt` costs ten minutes and all the momentum.

### 3. Decide how you hand out the target URL

Put it on the hand-out and on a slide. Participants will mistype it, and every
mistyped host is a scan against someone else's server.

## Rate limiting — read this before 20 people start scanning

`gobuster`'s default is 10 concurrent threads. Twenty participants against a
~200-word list is ~4 000 requests in a few seconds; against a full
`common.txt` (4 600 words) it is ~90 000. If the lab VMs share one egress IP,
Netlify sees a single source hammering the site and may start throttling or
blocking — mid-exercise, for everyone at once.

Mitigations, in order of effectiveness:

1. **Use the supplied wordlist** (`tools/workshop-wordlist.txt`, ~190 entries)
   rather than a full SecLists run. It contains every path that matters.
2. **Teach `-t 5`.** Lower thread counts are also better tradecraft: loud
   scanning is how real attackers get caught. That framing makes the
   restriction a lesson rather than a limitation.
3. **Stagger the start** if the group is large — half the room scans while the
   other half reads `robots.txt`.
4. **Self-host instead.** `docker compose up` in each participant's own VM
   removes the shared-egress problem completely and works offline. Same
   application, same chain; only the URL changes.

If Netlify does throttle you mid-session, switch the room to the local
container — this is exactly why the self-hosted runtime exists.

## Suggested run of show (60 minutes)

Adjust to the time you have; the blocks are independent.

| Time | Block | Content |
|---|---|---|
| 0:00 | Framing | Authorisation first: this target is explicitly authorised, everything else is not. Art. 143bis StGB in one sentence. |
| 0:05 | Recon | Everyone opens the site, reads `robots.txt`, finds `/backup/`. Discuss: is a `Disallow` a protection? |
| 0:15 | Enumeration | `gobuster` run, `/.env` found and read. **Flag 1.** |
| 0:25 | Access | Log in to `/intranet/`, explore the portal, export the hashes. **Flag 2.** |
| 0:35 | Cracking | `hashcat -m 0`, four of five passwords fall. **Flag 3** after logging in as `s.brunner`. |
| 0:50 | Debrief | The five fixes (see `scenario.md`), plus: which one would have stopped the attack earliest? |

Collecting flags in a shared chat or on a flipchart keeps the pace visible
without you asking "are you through yet?".

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `gobuster` reports every word as 200 | Wrong host, or a proxy intercepting. Verify with `curl -o /dev/null -w '%{http_code}' https://<ziel>/zufallstext123`. |
| `gobuster` finds nothing at all | Missing scheme in `-u`, or the VM has no outbound HTTPS. |
| `/.env` downloads instead of displaying | Browser content-type handling. Use `curl`, or the browser's view-source. |
| Login fails with correct credentials | Trailing whitespace pasted from the terminal. The username is case-insensitive, the password is not. |
| `hashcat` finds nothing | `rockyou.txt` still compressed, or `--username` missing so hashcat is trying to crack `s.brunner:5fcf…` as one string. |
| `hashcat` refuses to run on the VM | CPU-only VMs need `-D 1` (`--opencl-device-types 1`) on some builds; `john --format=raw-md5` is the fallback. |
| Portal shows "Nicht angemeldet" after a while | Session tokens expire after 4 hours. Log in again. |
| Participant is stuck at stage 3 | The Administration tab only appears for role `admin`. They cracked a password, but not `s.brunner`'s. |

Nothing in the application persists — there is no state to reset between
groups. Participants cannot lock each other out or modify the data.

## Ethics and authorisation

Say this explicitly at the start, and mean it:

- This target is authorised for this group, for this session.
- The same commands against any other host are, in Switzerland, potentially an
  offence under Art. 143bis StGB (unauthorised access to a data processing
  system) — regardless of intent and regardless of whether anything was
  changed.
- Port-scanning and enumerating infrastructure you do not own, including the
  CDN a site happens to sit behind, is not covered by "I was only looking".

That last point is the reason the nmap block needs its own target — see
[`port-scanning.md`](port-scanning.md).
