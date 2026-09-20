# hacken-erlaubt-lab

An intentionally vulnerable web application for the hands-on workshop
**«Hacken erlaubt — eine praktische Einführung ins Ethical Hacking»**.

Participants work through one realistic attack chain against a fictional
Zurich bicycle-courier company, *VeloRapid Zürich GmbH*, using the tools the
workshop teaches:

| Stage | Technique | Tool | What they find |
|---|---|---|---|
| 1 | Web enumeration | `gobuster` | A `.env` file left in the web root, with the portal credentials |
| 2 | Web enumeration | `gobuster` | An unlinked internal portal at `/intranet/`, opened with those credentials |
| 3 | Password cracking | `hashcat` | MD5 staff hashes in the portal's database view — cracking one escalates to admin |

Each stage yields a flag (`HACKEN-ERLAUBT{…}`), so progress is visible
without the facilitator looking over shoulders.

The third workshop technique, **network port scanning with `nmap`**, is
deliberately *not* part of this application — see
[`docs/port-scanning.md`](docs/port-scanning.md) for why and what to do
instead.

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
| [`docs/port-scanning.md`](docs/port-scanning.md) | Why nmap needs a different target, and the options |

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
docker compose up -d --build          # http://<host>:8443
node tools/verify.js --url http://<host>:8443
```

Without Docker, the server has no dependencies at all:

```bash
node server/server.js --port 8443
```

Checklist for a public host:

- **Open the port you publish** (`ufw allow 8443/tcp`, plus the provider's own
  firewall if it has one). Everything else stays closed unless the nmap module
  needs it — see [`docs/port-scanning.md`](docs/port-scanning.md).
- **Plain HTTP is fine** for a training target, and avoids a certificate
  detour. Put the real URL, scheme and port included, on the hand-out: for
  example `http://203.0.113.10:8443`, not `https://…`.
- **Choose the port deliberately.** A non-standard port is what makes a port
  scan worth running; if the nmap module lands on the same host, the web
  application should *only* be reachable there, so participants have to find
  it.
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
node tools/verify.js --url http://<host>:8443
```

This checks the data, the whole attack chain, and — against a live URL — that
`/.env`, `/backup/` and `/intranet/` are reachable and that unknown paths
still return 404 (a wildcard 200 would make `gobuster` useless).

## Layout

```
site/                 static site (German UI) — Netlify publish directory
  .env, _leak/        the leaked configuration file (stage 1)
  backup/             breadcrumbs from robots.txt
  intranet/           the portal: login + dispatcher dashboard (stages 2-3)
lib/                  data, auth and the API — shared by both runtimes
netlify/functions/    Netlify adapter
server/               dependency-free Node server for self-hosting
tools/                wordlist for gobuster + pre-flight verification
```

`lib/` holds the entire backend as one pure function so the hosted deployment
and the self-hosted container cannot drift apart.

## What is *not* vulnerable

Only the three weaknesses above are intended. Session tokens are HMAC-signed,
the database view is read-only with no free-form SQL, and the self-hosted
server blocks path traversal — participants should not be able to shortcut the
chain or break out of the sandbox. If you find another way through, that is a
bug worth an issue.

## License

MIT — see [`LICENSE`](LICENSE).
