# Stage 1: port scanning

The workshop opens here. Participants know one thing — an IP address — and
the scan is what turns it into a target: a web service on an unusual port,
which stages 2 to 4 then take apart.

## What the host exposes

`docker compose up -d` starts the web application and the decoy services
together. All of it is reachable from the participants' VMs:

| Port | What `nmap -sV` reports | Purpose |
|---|---|---|
| 2222 | `OpenSSH 7.6p1 Ubuntu 4ubuntu0.3` | "Hidden" SSH: moving a service off its default port hides it from nobody |
| 3306 | `MySQL 5.7.33-0ubuntu0.18.04.1` | A database listening to the internet |
| 6379 | `Redis key-value store 5.0.7` | The forgotten service — **outside nmap's top-1000**, so only a full scan finds it |
| 8088 | `nginx/1.14.0 (Ubuntu)` | The web application: the handover into stage 2 |
| 9999 | unrecognised; banner readable | Legacy "Dispo-Gateway", carries **flag 1** and names the web port |

The decoys are banners, not implementations. `nmap -sV` identifies a service
from what it says on connect, so a greeting is enough — and a real MySQL or
Redis on a public training host would be an actual vulnerability rather than
a taught one. There is nothing behind them to log into.

## The commands

```bash
# 1. What is open? (default scan: nmap's top 1000 ports)
nmap -Pn <ziel-ip>

# 2. What is actually running there?
nmap -sV -Pn -p 2222,3306,8088,9999 <ziel-ip>

# 3. Read a banner directly — this is where flag 1 is
nc <ziel-ip> 9999

# 4. The full scan finds what the default one missed
nmap -Pn -p- <ziel-ip>
```

Step 4 is the point of the exercise as much as step 1: Redis sits on 6379,
which is *not* in nmap's top-1000, so the default scan never sees it. "I
scanned it" and "I scanned all 65535 ports" are different statements.

Measured against the real thing, all five ports: `-sV` completes in about
11 seconds. A default scan is near-instant. Budget for network latency to the
droplet, not for the scan itself.

## Design notes

Three things were tuned by measurement, and are worth keeping that way:

- **The web application listens on 8088, not 8443.** nmap assumes TLS on
  8443 and never fingerprints a plain-HTTP service there — it reports
  `https-alt` with no version, and participants chase an `https://` URL that
  cannot work. On 8088 the same server is reported as `nginx/1.14.0
  (Ubuntu)`, which is exactly the handover stage 2 needs.
- **The gateway on 9999 greets and hangs up.** An interactive service that
  answers every probe but matches no fingerprint makes nmap work through its
  entire probe set: measured at **154 seconds for that one port**, versus
  about 1 second once it closes after its banner. Legacy banner daemons
  behave this way anyway.
- **The `Server:` header is set deliberately** (`nginx/1.14.0 (Ubuntu)`).
  Version disclosure is what the scan reads, and one more finding for the
  debrief: that version is from 2018 and tells an attacker which exploits to
  try first.

## Running it on a public host

- **Restrict real SSH (port 22) to your own address** in the provider's
  firewall. Otherwise participants scan it, find it, and the tidy story about
  port 2222 gets muddled by a genuine service you do not want anyone poking.
- **Docker bypasses ufw.** Docker writes its own iptables rules, so a
  `ufw deny` on a published port does not block it. Use the DigitalOcean
  Cloud Firewall (or equivalent) for anything you actually want closed.
- **Keep the decoys as decoys.** If you extend the module, add banners, not
  services. The moment a real database runs on that host, the exercise has a
  vulnerability nobody planned.
- **Destroy the droplet afterwards.** A deliberately vulnerable host with
  open decoy ports should not outlive the workshop.

## Authorisation

Scanning a host you rent is fine; the traffic still crosses the provider's
network, and twenty simultaneous aggressive scans look exactly like what they
are. Two rules for participants:

1. **Scan the one address on the hand-out.** Not the range around it — the
   neighbouring addresses in that datacentre belong to strangers, and a
   sweep is not covered by "I was only looking".
2. **Keep the default timing** (`-T3`). `-T4`/`-T5` from twenty VMs at once
   is a small load test, and speed buys nothing here.

This is also the moment to make the legal point concrete, before anyone has
typed a command: in Switzerland, unauthorised access to a data processing
system is an offence under Art. 143bis StGB, regardless of intent and
regardless of whether anything was changed.

## Why not Netlify (historical note)

The first deployment was on Netlify, which serves only 80 and 443 — nothing
to discover — and whose CDN edge belongs to Netlify, not to us, so pointing a
class at it could not honestly be called authorised. Netlify also blocks the
`gobuster` stage outright (see the README). Hosting on a machine the
organiser controls solved all three problems at once.
