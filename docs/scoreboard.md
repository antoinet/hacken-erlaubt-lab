# Flag check and presenter dashboard

Workshop tooling, not part of the VeloRapid fiction: participants claim a
name and submit the flags they find; the presenter watches the room's
progress on one screen.

| Who | URL | What they get |
|---|---|---|
| Participants | `http://<ip>/` | Name, flag input, four stage cards, confetti |
| Presenter | `http://<ip>/dashboard` | Per-stage counts and a found/not-found matrix |

It runs on **port 80**, so participants type nothing but the IP address — one
fewer thing to mistype in a room where everyone is already juggling ports.
The target application stays alone on 8088.

## No accounts, but no collisions either

There are no passwords and no e-mail addresses. A participant types a name
and the server hands back a random token, which the browser keeps in
`localStorage`; submissions carry that token. That is not authentication —
it exists so two people called "Max" do not overwrite each other, and so a
reload does not lose anybody's progress.

Consequences worth knowing before the session:

- **A cleared browser or a different device means a new name.** The token is
  the only thing linking a person to their row. This is a two-hour workshop,
  not an identity system.
- **Names are first-come.** A taken name is refused with a message, not
  silently merged.
- **Anyone can open the dashboard.** It was built that way on purpose: a
  visible scoreboard motivates a room, and it lets someone stuck at stage 2
  see that they are not the only one.

## What the dashboard shows

Per stage, a tile with the count (`6 / 7`) and a meter; below that, one row
per participant with `gefunden` / `offen` per stage and a total. Sorted by
number of stages solved, then alphabetically. No timestamps, no ranking by
speed — the point is to see *where the room is stuck*, not who is fastest.

The tiles usually read as a funnel. When stage 2 stops filling, it is time to
say something about wordlists; when stage 4 stalls, somebody's `rockyou.txt`
is still gzipped.

Status is never carried by colour alone: every cell pairs its colour with a
check glyph and the word `gefunden` or `offen`, so the projector's colour
rendering and colour-blind participants are both covered.

## Flags never reach the browser

Validation happens server-side. The flag values live in `lib/data.js`, which
the scoreboard imports — the same single source the decoy services and the
web application use. Nothing in the page source, the client JavaScript or any
API response contains a flag value, so "read the scoreboard's JavaScript" is
not a shortcut past the exercise. `tools/verify.js --board` asserts exactly
that.

Submissions are tolerant of case and surrounding whitespace, because people
retype these off a terminal and a workshop is no place to lose five minutes
to a capital letter.

## Operating it

```bash
docker compose up -d --build            # starts all three services
node tools/verify.js --board http://<ip> --decoys <ip> --url http://<ip>:8088
```

The pre-flight check registers a throwaway participant, submits a flag, reads
the dashboard and deletes itself again, so it leaves the scoreboard empty.

Progress lives in a Docker volume (`scoreboard-data`), so a container restart
does not wipe the room's work. **Between groups, clear it:**

```bash
docker compose down -v && docker compose up -d
```

If the volume is not writable the server logs a warning and keeps going in
memory rather than failing — a scoreboard that loses its history is an
annoyance, one that takes the session down is not.

## In the port scan

Port 80 will show up in stage 1, titled "Hacken erlaubt – Flag-Check". That
is intentional and harmless: it is visibly the workshop's own tooling, and
the page itself tells participants the target runs on a different port of the
same host — a gentle safety net for anyone who cannot find 8088.
