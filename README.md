# Fortune's Weave Companion

A fast, installable companion for **Fire Emblem: Fortune's Weave**. Add it to your phone's home screen and use it while you play, even offline.

**Live app:** https://ryan-guenther.github.io/fortunes-weave-companion/

## Features

- **Characters:** favorite and "really liked" gifts for all 63 giftable characters, plus categories that also work and items to avoid. A small number on a gift shows how many guides agree on it.
- **Items:** reverse lookup showing everyone who wants an item and where to buy it.
- **Paralogues:** pick a route (Cai, Dietrich, Theodora or Leda) to see each Part I paralogue's accept window, deadline, start location and rewards on a timeline. Enter your in-game date to see what's open now.
- **Classes:** the recommended class path for every character, grouped by role, with the game's five class tiers and how each unlocks.
- Works offline after the first visit, and remembers your route and date on your device.

## Install on your phone

- **iPhone:** open the link in Safari, then Share → Add to Home Screen.
- **Android:** open the link in Chrome, then Install app (or menu → Add to Home screen).

## Project layout

```
index.html              Page markup
css/styles.css          Styles (light and dark)
js/app.js               App logic: loads the data and renders each view
data/characters.json    Gifts per character
data/paralogues.json    Paralogue windows and deadlines per route
data/classes.json       Class tiers, roles and each character's recommended path
data/shops.json         Where to buy each item
data/sources.json       Guide names for the source codes used in characters.json
manifest.webmanifest    Name, colors and icons for installing
sw.js                   Service worker for offline use
icons/                  App icons
.github/workflows/      Deploys the site to GitHub Pages
```

There's no build step. The app is plain HTML, CSS and JavaScript.

## Editing the data

Most changes are edits to the JSON files in `data/`.

**A gift** in `characters.json`:

```json
{"item": "Volcano Ghosh", "sources": ["G8", "NGB"]}
```

Put it under `favorites` (double points) or `reallyLiked`. `sources` uses the codes in `sources.json`. Gifts with more sources are listed first, so keep the most confirmed items at the top.

**A paralogue route** in `paralogues.json`, with dates as `month/day`:

```json
"Cai": {"windows": [{"open": "9/17", "close": "9/25"}], "deadline": "9/25"}
```

Optional fields are `fixedBattleDate` (the fight happens on the deadline no matter when you accept) and `warning` (shown as "Watch out").

**A class path** in `classes.json`, where `role` is one of the role ids at the top of the file and `"A / B"` means either class works:

```json
{"name": "Peter", "role": "archer", "path": ["Hunter", "Archer", "Sniper", "Bow Adept"], "why": "Dedicated archer."}
```

An optional `tip` adds an extra note under the path.

## Running locally

The app loads its data with `fetch`, so open it through a local server rather than as a file:

```sh
python3 -m http.server
```

Then visit http://localhost:8000.

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`. It checks that the data files are valid JSON, stamps the service worker's cache version with the commit, and publishes to GitHub Pages. Installed copies pick up the new version on their next launch.

In the repo's **Settings → Pages**, the source must be set to **GitHub Actions**.

## Data sources

Gift, paralogue and class data is compiled from community guides and player reports: Game8, NightlyGamingBinge, Polygon, GameSpot, Selphie1999Gaming, KeenGamer, Pocket Tactics, GameTyrant and AllThings.How. Where sources disagree, the card says so. Corrections are welcome as issues or pull requests.

## License

[MIT](LICENSE) for this project's code.

Unofficial fan project, not affiliated with or endorsed by Nintendo or Intelligent Systems. Fire Emblem is a trademark of Nintendo, and game names and terms belong to their owners.
