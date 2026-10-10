# Minecraft agent

## Run

```sh
npm test
CONTROL_API_KEY='replace-me' npm start
```

The bot connects with offline authentication using `MC_HOST`, `MC_PORT`, and `BOT_USERNAME` (defaults are the existing server, port `25565`, and `Vicky`). The authenticated control API listens on `CONTROL_API_PORT` (default `3000`) and accepts `POST /command` with `Authorization: Bearer $CONTROL_API_KEY`.

Safe control types are `status`, `follow`, `stop`, `come`, `protect`, and `find_diamonds`. `collect_resource` and `build_house` require JSON `confirm: true`; admin types `time`, `weather`, `difficulty`, `teleport`, and `whitelist` also require confirmation and are sent only through the typed RCON allowlist. No arbitrary RCON or Minecraft command text is accepted.

Set `RCON_HOST`, `RCON_PORT`, and `RCON_PASSWORD` to enable those admin operations. Keep RCON bound to a private network; the HTTP API is bearer-authenticated but should also be network restricted.

Set `HERMES_API_URL` and `HERMES_API_KEY` to enable the optional language planner. It calls only `${HERMES_API_URL}/v1/chat/completions`, sends compact bot state plus the owner request, and independently validates the typed JSON response. `POST /plan` is bearer-authenticated and returns a proposal only; it never executes commands. Planner requests are bounded per owner with a small serialized queue, timeout, and rate limit. The planner cannot emit arbitrary RCON, shell, JavaScript, or raw Minecraft commands.

Unknown chat requests from the configured owner may receive a conversational reply or a validated proposal. Only validated non-destructive controller actions execute from chat. Collection, construction, and all privileged/RCON operations are proposals requiring a separate authenticated `POST /command` with `confirm: true`. Deterministic `Vicky pare`/`stop` handling stays ahead of the planner for immediate stopping. Offline-mode names remain spoofable, so chat is not an administrative trust boundary.
