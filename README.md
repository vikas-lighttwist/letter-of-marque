# Letters of Marque

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
- **The edge** — sail off the chart and you appear on the far side.
- **Zoom** — scroll / pinch, down to deck level.

Sink a ship and half her gold spills as flotsam; board her instead and you take
everything — the gold, part of the crew, and the ship herself.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design document.
