# Critical Path

A compact strategy game about leading an AI lab through the arrival of superintelligence. Set a standing allocation of AI labor, advance one quarter, and respond to decisions. Optional technical research puzzles improve safeguards. The ending reports human flourishing, human control, and personal ownership separately.

[Play on tkwa.me](https://tkwa.me/games/critical-path/) · [Model assumptions](docs/MODEL.md)

## <span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span> Run locally

From this directory:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/). The game uses native JavaScript modules, with no build step or runtime packages. Serve it over HTTP rather than opening the HTML file directly. `index.html` is the entry point; `campaign.html` redirects older preview links.

## <span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span> Check changes

```sh
npm ci
npm test
npm run lint
```

Tests use Node's built-in runner. `npm run test:all` runs lint and tests; `npm run test:coverage` adds coverage. Tests exercise production rules, save validation, research scoring, deterministic randomness, and the ending's physical model. Browser QA is still needed after interaction changes: play a campaign, restore a save, use the keyboard, and inspect a narrow viewport and reduced-motion mode.

The balance sweep plays all six labs with 12 strategies and 40 seeds: 2,880 complete campaigns. It checks that each run finishes and serializes, and reports timing, risk, finances, treaties, and separate ending outcomes. Use `--seeds 1` for a quick 72-campaign check. Without `--output`, the JSON summary prints to the terminal.

```sh
node scripts/campaign-balance.mjs --output /tmp/critical-path-balance.json
```

## <span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span> Code boundaries

| Files | Responsibility |
| --- | --- |
| `campaign.js` | Campaign rules, quarterly forecasts, allocations, finite product cohorts, research rewards, transition outcomes, save validation. No DOM or storage access. |
| `campaign-events.js` | Event definitions, prerequisites, costs, and effects. |
| `random.js` | Seeded random streams and validated snapshots. |
| `research-puzzles.js` | Puzzle generation and scoring without DOM dependencies. |
| `research-games.js`, `research-games.css` | Puzzle interaction and cleanup. |
| `game.js`, `game.css`, `index.html` | Interface, browser saves, import/export, accessibility, and component lifecycles. |
| `cosmos-math.js`, `cosmos.js` | Industrial model, astronomical scale, and Canvas ending animation. |

Campaign functions mutate the supplied plain state; forecasts and renderers must not advance its random stream. Use `serializeCampaign` and `restoreCampaign` at the save boundary. Browser autosaves use `critical-path-campaign-v1`; exported JSON supports transfer between browsers.

The same code version, lab, seed, decisions, and research scores reproduce a campaign. Saves include the random stream and resolved outcome. Replaying or seeking the ending must not reroll it. Changes to the save schema or random algorithm require an explicit compatibility decision and corresponding tests. Dispose research and Cosmos controllers when their views are removed.

## <span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span> Source and history

This repository supplies the runtime imported by `scripts/sync-critical-path.py` in `tkwa/website`. The `gh-pages` branch redirects the old game address to tkwa.me.

The [original README and design notes](docs/original-design.md) are preserved verbatim. Additional [prototype notes](docs/prototype/) describe the retired implementation. Git checkpoint `0be4a44` retains that runtime; these historical plans are not requirements for the current game.
