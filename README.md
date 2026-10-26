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
| `_headers` | Cloudflare Pages settings so players always get the newest version |

The files load in this order: `engine.js`, `bots.js`, `sound.js`, `game.js`. The 3D library (three.js r128) loads from a CDN.

## Playing locally

Double-click `index.html` to open it in a browser. Everything works offline except the fonts and the 3D library, which load from the internet.

## Publishing an update

1. Replace the changed files in the GitHub repository.
2. In `index.html`, bump the `?v=` number on the changed files (for example `?v=0.22` to `?v=0.23`).
3. Commit. Cloudflare Pages publishes the new version within about a minute.

Saved games and profiles live in each player's browser and are kept across updates. A saved game only stops loading if an update changes the rules (the `RULESET` number in `js/engine.js`).

## Version

0.24.1
