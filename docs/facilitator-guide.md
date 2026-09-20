# Facilitator guide

Everything needed to run the session: port scanning, web enumeration and
password cracking, in that order. For the attack chain itself see
[`scenario.md`](scenario.md); for the scanning stage specifically,
[`port-scanning.md`](port-scanning.md).

## Before the session

### 1. Deploy and verify

```bash
docker compose up -d --build
node tools/verify.js --url http://<host>:8088 --decoys <host>
```

All checks must pass. The ones that matter most:

- **`/.env` returns 200 with the credentials.** Without it there is no
  stage 3.
- **An unknown path returns 404.** If a catch-all returns 200, `gobuster`
  reports every word as a hit and the exercise is dead.
- **The five decoy checks pass.** Run them from outside the host as well as
  on it — a provider firewall that blocks 6379 or 9999 silently removes the
  full-scan lesson and flag 1.

Then scan it yourself, from a machine like the participants':

```bash
nmap -Pn <host> && nmap -sV -Pn -p 2222,3306,8088,9999 <host>
```

You should see ssh/mysql/nginx/unknown, and **not** port 22 — restrict real
SSH to your own address in the provider's firewall first.

### 2. Check the participant VMs

| Needed | Check |
|---|---|
| `nmap` | `nmap --version` |
| `netcat` | `nc -h` — for the banner grab in stage 1 |
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

## Do not run the enumeration exercise against Netlify

This was tried and it does not work: Netlify's abuse protection **blocks** the
scanning client rather than slowing it down, and the enumeration stage stops
dead. A shorter wordlist and `-t 5` do not prevent it — the protection reacts
to the pattern, not only the volume. Host the target yourself (see the README);
Netlify is fine for showing the site, nothing more.

Two things still matter on your own host:

1. **Thread count is tradecraft, not just politeness.** `gobuster`'s default
   is 10 concurrent threads; twenty participants is 200 concurrent requests at
   your little server. It will cope — the files are tiny — but teach `-t 5`
   anyway, because loud scanning is how real attackers get caught. If you have
   access logs, show them during the debrief: a wall of 404s from one address
   in four seconds is exactly what the defender sees.
2. **Use the supplied wordlist.** `tools/workshop-wordlist.txt` (~190 entries)
   contains every path that matters. A full SecLists run adds thousands of
   requests and finds nothing extra.

## Suggested run of show (90 minutes)

Adjust to the time you have. Stage 1 runs first by design: the scan is what
hands over the web port, so the chain reads as one story rather than three
exercises.

| Time | Block | Content |
|---|---|---|
| 0:00 | Framing | Authorisation first: this one IP is authorised, the range around it is not. Art. 143bis StGB in one sentence. |
| 0:05 | Scanning | `nmap -Pn`, then `-sV` on what turned up. `nc <ip> 9999` for the banner. **Flag 1.** |
| 0:20 | Full scan | `nmap -p-` finds Redis on 6379, which the default scan missed. Discuss why the defaults exist. |
| 0:30 | Enumeration | `gobuster` against the web port, `/.env` found and read. **Flag 2.** |
| 0:45 | Access | Log in to `/intranet/`, explore the portal, export the hashes. **Flag 3.** |
| 0:55 | Cracking | `hashcat -m 0`; four of five passwords fall. **Flag 4** after logging in as `s.brunner`. |
| 1:10 | Debrief | The six fixes (see `scenario.md`), plus: which one would have stopped the attack earliest? |

Collecting flags in a shared chat or on a flipchart keeps the pace visible
without you asking "are you through yet?".

If you are short on time, cut the full-scan block (0:20) rather than
compressing the debrief — it is the block that makes the rest a lesson
instead of a game.

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
| Participant is stuck at the last stage | The Administration tab only appears for role `admin`. They cracked a password, but not `s.brunner`'s. |
| `nmap -sV` takes minutes | Expected against an unrecognised service — but not here: all five ports finish in ~11s. If it crawls, check that the decoys are the current version (the gateway on 9999 must close after its banner). |
| nmap reports 8088 as `https-alt` or the web app is unreachable | The application must be published on 8088, not 8443 — nmap assumes TLS on 8443 and never fingerprints plain HTTP there. |
| Participants see port 22 | Real SSH is exposed. Restrict it to your own address in the provider's firewall; `ufw` will not do it, because Docker bypasses ufw. |
| A decoy port is unreachable from the VMs | Provider firewall. Docker's own rules publish the port regardless of `ufw`. |

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

Two concrete rules for the scanning block, which is where this stops being
abstract:

1. Scan **the one address on the hand-out**, never the range around it. The
   neighbouring addresses in that datacentre belong to strangers.
2. Keep the default timing (`-T3`). Twenty aggressive scans at once is a
   small load test, and speed buys nothing.

See [`port-scanning.md`](port-scanning.md) for the host-side setup.
