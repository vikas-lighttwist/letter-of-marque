# Letter of Marque

**Play it now: https://letter-of-marque.onrender.com** — works on desktop and phones (add to home screen for fullscreen).

A cel-shaded 3D naval action game for the browser. You are an English privateer in the
Caribbean — hunt Spanish ships, weaken them with broadsides, **board** them to seize
their gold and add them to your growing fleet.

Built with [Three.js](https://threejs.org) + Vite. All models, textures and sounds are
procedural — no assets, no downloads.

## Play

```bash
npm install
npm run dev        # → http://localhost:5173
```

Works with a trackpad, mouse, or touchscreen:

- **Steer** — click/touch and hold on the sea; the ship turns toward the ring.
- **Sails** — `−` / `+` buttons (or `W`/`S`). Watch the **wind dial**: run with the wind for a burst of speed.
- **Fire** — the `🔥 FIRE` button (or `Space`) lets fly both broadsides. It glows when guns bear.
- **Board** — the green `BOARD` button appears when a weakened enemy is alongside (or `F`).
- **Fleet** — tap a ship in the fleet panel to command her (or `C`); set the others to ⚑ follow or ⚔ hunt on their own.
- **Islands** — slow down near shore, `⚓ Drop Anchor`, then `🚶 Go Ashore`: row in and explore in third person. Tap the captain's parrot — trust us.
- **Port** — the gold ⚓ island on the minimap is a safe harbor; walk up to the market house to buy cannon, crew, repairs.
- **The Thirsty Parrot** — the port tavern: buy the crew food and fizz for real speed/repair buffs, buy treasure maps and go **dig up chests**, and play *Ship, Captain & Crew* dice against One-Eyed Meg for gold — or bet a whole ship.
- **The edge** — sail off the chart and you appear on the far side.
- **Zoom** — scroll / pinch, down to deck level.

Sink a ship and half her gold spills as flotsam; board her instead and you take
everything — the gold, part of the crew, and the ship herself.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design document.


## Deployment

Hosted as a Render static site (same workspace as framediff), defined in
`render.yaml`. Pushes to `main` on GitHub auto-deploy; manual deploys via
`render deploys create srv-d9dbvtbrjlhs73eqi00g`.

- Live: https://letter-of-marque.onrender.com
- Repo: https://github.com/vikas-lighttwist/letter-of-marque
- Dashboard: https://dashboard.render.com/static/srv-d9dbvtbrjlhs73eqi00g
