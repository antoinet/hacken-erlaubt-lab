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

### Locally / in a lab VM (no dependencies, works offline)

```bash
node server/server.js --port 8080     # http://localhost:8080
```

or, on a non-standard port via container:

```bash
docker compose up --build             # http://localhost:8443
```

### On Netlify

Connect the repository; `netlify.toml` sets `site/` as the publish directory
and `netlify/functions/` as the functions directory. No build step, no
dependencies.

After every deployment, verify that the exercise is intact:

```bash
node tools/verify.js --url https://<your-site>.netlify.app
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
