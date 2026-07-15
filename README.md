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
- **Sails** — `−` / `+` buttons (or `W`/`S`).
- **Broadsides** — `PORT` / `STARBOARD` buttons (or `Q`/`E`). They glow when an enemy is in the arc.
- **Board** — the green `BOARD` button appears when a weakened enemy is alongside (or `F`).
- **Zoom** — scroll / pinch.

Sink a ship and half her gold spills as flotsam; board her instead and you take
everything — the gold, part of the crew, and the ship herself.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design document.
