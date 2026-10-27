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
| `favicon.svg` | The browser tab icon |
| `worker/index.js` | The server: serves the site and runs online game rooms (Cloudflare Durable Objects) |
| `wrangler.jsonc` | Cloudflare settings: the Worker's name, the site files and the rooms |
| `.assetsignore` | Keeps the server files and settings private (not served as web pages) |
| `_headers` | Cloudflare Pages settings so players always get the newest version |

The files load in this order: `engine.js`, `bots.js`, `sound.js`, `game.js`. The 3D library (three.js r128) loads from a CDN.

## Online play

Online games run through rooms on the site's own Worker. Every player connects to the room over a WebSocket at `/room/<CODE>`; the host's browser runs the game and the room only passes messages between the host and the guests. Rooms are free on the Workers Free plan at this scale. The Worker's name in `wrangler.jsonc` must match the Worker in your Cloudflare account (`highhorn`).

## Playing locally

Double-click `index.html` to open it in a browser. Everything works offline except the fonts, the 3D library and online play (which needs the website's rooms).

## Publishing an update

1. Replace the changed files in the GitHub repository.
2. In `index.html`, bump the `?v=` number on the changed files (for example `?v=0.22` to `?v=0.23`).
3. Commit. Cloudflare Pages publishes the new version within about a minute.

Saved games and profiles live in each player's browser and are kept across updates. A saved game only stops loading if an update changes the rules (the `RULESET` number in `js/engine.js`).

## Version

0.25
