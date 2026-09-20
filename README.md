# hacken-erlaubt-lab

An intentionally vulnerable web application for the hands-on workshop
**«Hacken erlaubt — eine praktische Einführung ins Ethical Hacking»**.

Participants work through one realistic attack chain against a fictional
Zurich bicycle-courier company, *VeloRapid Zürich GmbH*, covering all three
techniques the workshop teaches:

| Stage | Technique | Tool | What they find |
|---|---|---|---|
| 1 | Port scanning | `nmap`, `nc` | Forgotten services on odd ports — and the web application on 8088 |
| 2 | Web enumeration | `gobuster` | A `.env` file left in the web root, with the portal credentials |
| 3 | Web enumeration | `gobuster` | An unlinked internal portal at `/intranet/`, opened with those credentials |
| 4 | Password cracking | `hashcat` | MD5 staff hashes in the portal's database view — cracking one escalates to admin |

Each stage is the next one's starting point: the scan hands over the web
port, enumeration hands over the credentials, the portal hands over the
hashes. Each yields a flag (`HACKEN-ERLAUBT{…}`), so progress is visible
without the facilitator looking over shoulders.

> [!WARNING]
> **This application is vulnerable on purpose.** Deploy it only as a training
> target, never alongside real data, on a real company domain, or on a host
> that matters. Everything in it — the company, the people, the customers,
> the credentials — is fictional.

## Documentation

| Doc | For whom |
|---|---|
| [`docs/scenario.md`](docs/scenario.md) | The story, the attack chain, the full solution (**spoilers**) |
| [`docs/facilitator-guide.md`](docs/facilitator-guide.md) | Running the session: prerequisites, run-of-show, troubleshooting |
| [`docs/handout-de.md`](docs/handout-de.md) | The participant hand-out, in German, spoiler-free |
| [`docs/design-decisions.md`](docs/design-decisions.md) | Why the scenario is built this way, and what was rejected |
| [`docs/port-scanning.md`](docs/port-scanning.md) | The scanning stage: services, commands, host setup |

## Running it

> [!IMPORTANT]
> **Netlify cannot host the gobuster exercise.** Netlify's abuse protection
> blocks the scanning client — not merely throttles it — so the enumeration
> stage dies mid-session. Lower thread counts and a short wordlist do not
> avoid this. Host the application yourself; Netlify is only useful as a
> read-only preview of the site.

### On a host you control (the deployment the workshop uses)

Any small VM works — a DigitalOcean droplet, a VM in the lab, a laptop on the
room's network. Docker is the least fiddly route:

```bash
git clone https://github.com/antoinet/hacken-erlaubt-lab.git
cd hacken-erlaubt-lab
docker compose up -d --build
node tools/verify.js --url http://<host>:8088 --decoys <host>
```

That starts both halves of the environment: the web application on **8088**,
and the decoy services the scanning stage discovers on 2222, 3306, 6379 and
9999. Without Docker, each runs on its own and needs no dependencies:

```bash
node server/server.js --port 8088     # the web application
node decoys/server.js                 # the decoy services
```

Checklist for a public host:

- **Open the five workshop ports** — 2222, 3306, 6379, 8088, 9999 — and
  **restrict real SSH (22) to your own address**, or participants will find
  it and the story about port 2222 gets muddled. Note that Docker writes its
  own iptables rules and **bypasses ufw**: use the provider's firewall
  (DigitalOcean Cloud Firewall) for anything you want actually closed.
- **Plain HTTP is fine** for a training target, and avoids a certificate
  detour. Put the real URL, scheme and port included, on the hand-out: for
  example `http://203.0.113.10:8088`, not `https://…`. The hand-out gives
  participants only the IP — finding the port is stage 1.
- **Leave the web application on 8088 only.** Publishing it on 80 or 443 as
  well removes the point of the scan. 8443 is a bad choice specifically:
  nmap assumes TLS there and never fingerprints a plain-HTTP service on it.
- **Use a throwaway host.** This application is vulnerable by design. Give it
  its own VM, nothing else on it, SSH by key only — and destroy it after the
  workshop rather than leaving an open training target on the internet.
- **Restrict the source if you can.** If the lab has a known egress address,
  limiting inbound traffic to it keeps the target off the wider internet for
  the price of one firewall rule.

The container runs unprivileged, holds no real data and writes nothing to
disk, so a compromise of the application itself costs you the VM and nothing
else.

### On Netlify (preview only)

Connect the repository; `netlify.toml` sets `site/` as the publish directory
and `netlify/functions/` as the functions directory. No build step, no
dependencies. Useful for showing the site or checking a change — not for the
enumeration exercise, per the warning above.

### Verify after every deployment

```bash
node tools/verify.js --url http://<host>:8088 --decoys <host>
```

This checks the data and the whole attack chain; against a live host it also
confirms that `/.env`, `/backup/` and `/intranet/` are reachable, that
unknown paths still return 404 (a wildcard 200 would make `gobuster`
useless), and that each decoy still answers with the banner its stage needs.
Run it from outside the host as well — a provider firewall blocking 6379 or
9999 silently removes flag 1 and the full-scan lesson.

## Layout

```
site/                 static site (German UI) — the web application's document root
  .env, _leak/        the leaked configuration file (stage 1)
  backup/             breadcrumbs from robots.txt
  intranet/           the portal: login + dispatcher dashboard (stages 2-3)
lib/                  data, auth and the API — shared by both runtimes
netlify/functions/    Netlify adapter
server/               dependency-free Node server for self-hosting
decoys/               banner-only services for the port-scanning stage
tools/                wordlist for gobuster + pre-flight verification
```

`lib/` holds the entire backend as one pure function so the hosted deployment
and the self-hosted container cannot drift apart.

## What is *not* vulnerable

Only the weaknesses above are intended. Session tokens are HMAC-signed, the
database view is read-only with no free-form SQL, the self-hosted server
blocks path traversal, and the decoy services are banners with nothing behind
them — no real MySQL, no real Redis, nothing to log into. Participants should
not be able to shortcut the chain or break out of the sandbox. If you find another way through, that is a
bug worth an issue.

## License

MIT — see [`LICENSE`](LICENSE).
