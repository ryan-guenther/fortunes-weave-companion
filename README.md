# Fortune's Weave Companion

A fast, offline-capable companion for **Fire Emblem: Fortune's Weave**. Install it on your phone's home screen and use it while you play.

**Live app:** https://ryan-guenther.github.io/fortunes-weave-companion/

## Features

- **Characters:** favorite and "really liked" gifts for all 63 giftable characters, plus categories that also work and items to avoid.
- **Items:** reverse lookup showing everyone who wants an item and where to buy it.
- **Paralogues:** pick a route (Cai, Dietrich, Theodora, Leda) to see each Part I paralogue's accept window, deadline, start location and rewards on a timeline. Enter your in-game date to see what is open now.
- Works offline after the first visit, and remembers your route and date on your device.

## Install on your phone

- **iPhone:** open the link in Safari, then Share → Add to Home Screen.
- **Android:** open the link in Chrome, then Install app (or menu → Add to Home screen).

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles, data and script in one file |
| `manifest.webmanifest` | App name, colors and icons for installing |
| `sw.js` | Service worker for offline use |
| `icon-*.png`, `apple-touch-icon.png` | App icons |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Updating

1. Edit or replace `index.html`.
2. Bump `VERSION` on line 2 of `sw.js` (for example `companion-v1` → `companion-v2`) so installed copies pick up the change.
3. Commit to `main`. GitHub Pages redeploys in a minute or two.

## Data sources

Gift and paralogue data is compiled from community guides and player reports:
Game8, NightlyGamingBinge, Polygon, GameSpot, Selphie1999Gaming, KeenGamer, Pocket Tactics and GameTyrant.
Where sources disagree, the card notes it. Corrections are welcome via issues or pull requests.

## Disclaimer

Unofficial fan project, not affiliated with or endorsed by Nintendo or Intelligent Systems. Fire Emblem is a trademark of Nintendo. The MIT license covers this project's code; game names and terms belong to their owners.
