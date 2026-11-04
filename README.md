# Highhorn

A 3D hex board game for the browser: settle the highlands, gather resources, raise armies and outwit your rivals.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page itself: loads everything below |
| `css/style.css` | All styles |
| `js/engine.js` | The rules engine, game data and map generation. Pure: no graphics, so it can also run on a server |
| `js/bots.js` | The AI opponents |
| `js/sound.js` | Sound effects, music and ambience (generated in the browser, no audio files) |
| `js/game.js` | The 3D board, interface, lobby, saving, game flow and online play |
| `js/hero-commoner.js` | Commoner model catalog, Hero Creator previews, portraits and board figures |
| `js/hero-toon.js` | Shared soft skin and hard clothing lighting bands |
| `Models/Heroes/*/Toon_v1/` | Detailed and board Commoner models plus portraits |
| `favicon.svg` | The browser tab icon |
| `worker/index.js` | The server: serves the site and runs online game rooms (Cloudflare Durable Objects) |
| `wrangler.jsonc` | Cloudflare settings: the Worker's name, the site files and the rooms |
| `.assetsignore` | Keeps the server files and settings private (not served as web pages) |
| `_headers` | Cloudflare Pages settings so players always get the newest version |

The files load in this order: `engine.js`, `bots.js`, `sound.js`, `hero-toon.js`, `hero-commoner.js`, `game.js`. The 3D library (three.js r128) loads from a CDN.

## Online play

Online games run through rooms on the site's own Worker. Every player connects to the room over a WebSocket at `/room/<CODE>`; the host's browser runs the game and the room only passes messages between the host and the guests. Rooms are free on the Workers Free plan at this scale. The Worker's name in `wrangler.jsonc` must match the Worker in your Cloudflare account (`highhorn`).

## Playing locally

From the project root, run `node Scripts/Highhorn_Game_Server.cjs` and open `http://localhost:8001`. Stop the server with Ctrl+C. Model loading requires an HTTP server; fonts and Three.js load from CDNs. Online rooms require the deployed Worker.

## Publishing an update

1. Update the visible lobby/menu version, the update notes in `js/game.js`, this README and local CSS/JavaScript cache versions in `index.html`.
2. Verify `.gitignore` and `.assetsignore`. Local source art, Blender files, test profiles, recovery archives and exports stay out of uploads. Both current `Toon_v1` runtime packages must remain included; explicitly allow future character packages in `.assetsignore`.
3. Run the relevant checks and review the commit. Push to GitHub `main` only with release authorization: each push automatically triggers the Cloudflare production deployment at `highhorn.ghostjumper007.workers.dev`.

Saved games and profiles live in each player's browser and are kept across updates. A saved game only stops loading if an update changes the rules (the `RULESET` number in `js/engine.js`).

## Version

0.27.0 — Toon Commoners

Male and Female Commoners share the accepted painted style, with detailed Hero Creator models, smaller board models, refreshed portraits, animated previews and stable bot identities. Existing saved model choices are retained. The gameplay ruleset remains `0.20.0`.
