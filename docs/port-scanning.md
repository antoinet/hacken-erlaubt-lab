# The nmap module: why it is not part of this application

The workshop teaches three techniques. This repository covers two of them.
Port scanning needs a different target, for two independent reasons.

## 1. There is nothing to scan

Netlify serves HTTP on 80 and HTTPS on 443, and redirects the former to the
latter. There is no way to expose a service on another port — no custom
listeners, no raw TCP, no way to make the platform answer on 8080 or 3306.
An `nmap` run against a Netlify-hosted site finds 80 and 443, which is exactly
what it finds against every other Netlify site. There is no discovery to make,
and therefore nothing to learn.

## 2. The host is not ours to scan

A Netlify site resolves to shared CDN edge addresses operated by Netlify and
serving thousands of unrelated customers. Pointing a class at those addresses
means scanning third-party infrastructure that the workshop organiser cannot
authorise — and telling participants "this target is authorised" would be
false. In a workshop whose entire premise is the difference between authorised
and unauthorised access, that is the one corner that must not be cut.

## What to do instead

The scan target must be a host under your own control, ideally one already
inside the lab. Options, most to least attractive:

### A. A target container inside each participant's own VM (recommended)

Each participant scans `localhost` or a second container on the lab bridge
network. Self-contained, offline-capable, no shared infrastructure to overload
and no authorisation question at all — everyone scans their own machine.

`docker-compose.yml` in this repository already runs the web application on
the non-standard port 8443 for exactly this purpose. The module would add
further services with recognisable banners, for example:

| Port | Service | Teaching point |
|---|---|---|
| 22 → 2222 | SSH on a moved port | "Hidden" ports are found in seconds |
| 8443 | This web application | The scan *leads into* the gobuster exercise |
| 3306 | MySQL banner | Database exposed to the network |
| 6379 | Redis without auth | The classic forgotten service |

This also chains the three techniques into one story: scan → find the web app
on an odd port → enumerate it → crack what you find. Currently the gobuster
stage starts from a URL handed out on a slide; with this module it starts from
something the participants discovered themselves.

### B. A dedicated target VM in the lab

One shared VM per class, scanned over the lab network. Closer to a real
network scan (`nmap -sV 10.0.0.0/24` finds hosts, not just ports), but it is
shared infrastructure: 20 concurrent `-T4` scans against one host is itself a
small load test, and one participant's mistake affects everyone.

### C. The host that already serves the web exercise

Since Netlify cannot host the enumeration stage (see the README), the workshop
target is a VM the organiser controls anyway — in the first run, a DigitalOcean
droplet. That changes the arithmetic completely: this option used to mean
buying, hardening and babysitting a VPS for one exercise, and now it means
adding services to a host that already exists.

It also makes the best version of the narrative possible: the web application
listens *only* on a non-standard port, so the scan is not a warm-up exercise
but the thing that reveals the target for stage two.

Candidate services on that host:

| Port | Service | Teaching point |
|---|---|---|
| 2222 | SSH moved off 22 | A "hidden" port is found in seconds |
| 8443 | This web application | The scan leads into the gobuster exercise |
| 3306 | MySQL banner | A database exposed to the network |
| 6379 | Redis without auth | The classic forgotten service |

Caveats, none fatal:

- **Everything is real and public.** Decoy services must be decoys — banners,
  not actual databases. `nmap -sV` reads a banner perfectly well without a
  real MySQL behind it.
- **Scanning your own VM is legitimate**, but the traffic crosses the
  provider's network, and twenty concurrent `-T4` scans look like exactly what
  they are. Keep `-T3`, and prefer a targeted `-p-` on one host over sweeping
  a range you do not own — the neighbouring addresses in that datacentre are
  someone else's.
- **Destroy it afterwards.** A deliberately vulnerable host with open decoy
  ports should not outlive the workshop.

## Recommendation

Build the module on the workshop host (option C), with the web application
reachable only on its non-standard port. Option A (a container per
participant VM) stays the better choice if the workshop ever has to run
offline, and both use the same `docker-compose.yml`.

Open question for the first session: run the nmap module **before** the web
exercise (discovery leads into enumeration — the better story, but a hard
dependency: if the host is unreachable, the whole chain stalls) or **after**
it (independent blocks, each survivable on its own).
