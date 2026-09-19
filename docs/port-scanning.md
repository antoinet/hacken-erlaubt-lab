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

### C. A VPS you own

Realistic and internet-facing, but it costs money, needs hardening, needs an
abuse-report plan, and the scans leave your lab and cross someone's transit
network. Not worth it for a beginner workshop.

## Recommendation

Option A, built as a second module in this repository (`nmap/` alongside
`site/`), reusing the existing `docker-compose.yml`. It keeps the whole
workshop in one artefact, works without internet, and makes the three
techniques one continuous chain rather than three disconnected exercises.

Open question for the first session: run the nmap module **before** the web
exercise (discovery leads into enumeration — better narrative, but a hard
dependency: if the container does not start, the whole chain stalls) or
**after** it (independent blocks, each survivable on its own).
