# Minecraft agent

## Run

```sh
npm test
CONTROL_API_KEY='replace-me' npm start
```

The bot connects with offline authentication using `MC_HOST`, `MC_PORT`, and `BOT_USERNAME` (defaults are the existing server, port `25565`, and `Vicky`). The authenticated control API listens on `CONTROL_API_PORT` (default `3000`) and accepts `POST /command` with `Authorization: Bearer $CONTROL_API_KEY`.

Safe control types are `status`, `follow`, `stop`, `come`, `protect`, and `find_diamonds`. `collect_resource` and `build_house` require JSON `confirm: true`; admin types `time`, `weather`, `difficulty`, `teleport`, and `whitelist` also require confirmation and are sent only through the typed RCON allowlist. No arbitrary RCON or Minecraft command text is accepted.

Set `RCON_HOST`, `RCON_PORT`, and `RCON_PASSWORD` to enable those admin operations. Keep RCON bound to a private network; the HTTP API is bearer-authenticated but should also be network restricted.

Chat commands are Portuguese and limited to safe bot behavior. The configured owner defaults to `itforget`, but offline-mode usernames are spoofable; chat never exposes administrative commands. Diamond search uses only visible nearby ore found by Mineflayer and reports unavailable rather than using xray. Collection digs only when an explicitly authorized controller operation is invoked. House construction requires inventory materials and never gathers them implicitly.
