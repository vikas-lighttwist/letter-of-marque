# Letter of Marque — Game Design Document

*A cel-shaded 3D naval action game for the browser. You are an English privateer in the
Caribbean, out of Port Royal in 1668, carrying a letter of marque: every Spanish sail on
the horizon is a prize waiting to be taken.*

---

## 1. High Concept

Third-person naval combat sandbox. You captain a single ship at the start; by out-sailing,
out-gunning and **boarding** Spanish vessels you capture them into a growing fleet, seize
their gold, and swell your crew. Bigger prizes need bigger fleets — the endgame is taking
a Spanish **Ship of the Line** and amassing 10,000 gold.

**Design pillars**

1. **Readable at a glance** — cel-shaded, flat-banded color; every ship's class, health,
   gold and capture progress is visible in-world.
2. **One hand is enough** — fully playable with a trackpad or a touchscreen: hold-to-steer,
   big tap targets for broadsides and boarding.
3. **Greed vs. gunpowder** — sinking a ship destroys most of her gold; boarding takes time
   and crew. The tension between "send her to the bottom" and "take her whole" drives
   every engagement.

## 2. Setting & Fiction

- Caribbean, age of sail. Open turquoise sea dotted with small islands.
- Player faction: **England** (privateer flying the English ensign).
- Enemy faction: **Spain** (merchant convoys, escorts, and men-of-war).
- No missions or dialogue in v1 — the sandbox *is* the game. Fiction is delivered through
  the intro card and ship names.

## 3. Core Loop

```
  Spot a sail → identify her class/gold → close in → cannon duel to weaken her
      → BOARD and capture (gold + ship + crew)   or   SINK her (partial gold as flotsam)
      → repair, grow the fleet → hunt bigger prizes → Ship of the Line → legend
```

## 4. Controls

Designed trackpad-first / touch-first. Keyboard is a power-user overlay, never required.

| Action            | Trackpad / Mouse                          | Touch                       | Keyboard |
|-------------------|-------------------------------------------|-----------------------------|----------|
| Steer             | Click-hold on the sea — ship turns toward the pointer (a target ring shows where) | Touch-hold on the sea       | `A` / `D` |
| Sails (speed)     | HUD `−` / `+` buttons                     | Same buttons (big targets)  | `S` / `W` |
| Fire port guns    | HUD **PORT** button                       | Same                        | `Q` |
| Fire starboard    | HUD **STARBOARD** button                  | Same                        | `E` |
| Board             | Contextual **BOARD** button (appears when a weakened enemy is alongside) | Same | `F` |
| Camera zoom       | Scroll / two-finger scroll                | Pinch                       | `Z`/`X` |

Notes:
- Steering is *positional*, not twitchy: the ship continuously turns toward the held
  pointer's sea position. Releasing keeps the current heading. This makes a trackpad
  click-drag and a thumb press equally comfortable.
- Fire buttons light up when enemies are inside that broadside's arc and range —
  no aiming skill needed beyond positioning the ship.
- All HUD buttons are ≥ 56 px touch targets.

## 5. Camera

- Third-person chase camera behind and above the flagship; smoothed follow (position and
  heading lag slightly for a feeling of weight).
- Zoom range ~18 m (deck-level, see your crew) to ~70 m (tactical, read the whole fight).
- Camera never needs manual orbiting to play; it always settles behind the ship.

## 6. Ships

All ships are procedurally assembled low-poly models (hull, fore/stern castles, masts,
yards, sails, cannons, flag) with toon materials + dark outlines. Class silhouette must be
identifiable at 150 m: size, mast count, and gun count are the tells.

| Class            | Role                   | Guns/side | HP  | Speed | Turn | Crew | Gold carried |
|------------------|------------------------|-----------|-----|-------|------|------|--------------|
| **Sloop**        | scout, easy first prey | 2         | 60  | ★★★★★ | ★★★★★| 8    | 20–60        |
| **Brigantine**   | player's starting ship | 4         | 100 | ★★★★  | ★★★★ | 14   | 50–120       |
| **Frigate**      | escort, real fight     | 7         | 160 | ★★★   | ★★★  | 24   | 100–250      |
| **Galleon**      | *treasure ship* — slow, rich, runs away | 5 | 220 | ★★ | ★★ | 20 | 400–800 |
| **Ship of the Line** | huge, bristling with guns; endgame prize | 12 | 340 | ★★★ | ★ | 40 | 200–450 |

Per-ship state: `hp/maxHp`, `crew`, `gold`, `sailSetting (0–3)`, `speed`, `heading`,
`faction`, `class`, cooldowns per broadside.

**In-world ship label** (floating billboard, always readable):
- Name + class (e.g. *"Nuestra Señora — Galleon"*), faction color.
- **Health bar** (red).
- **Gold meter** (gold bar + number) — the "is she worth boarding?" signal.
- **Capture bar** (green) — appears during boarding, fills to takeover.
- Friendly fleet ships show name + health only.

Off-screen enemies get small edge-of-screen arrows so the horizon is never empty-feeling.

## 7. Combat

### 7.1 Cannons
- Broadsides only (historically honest, and it makes positioning the whole skill).
- Firing a side launches every loaded gun on that side in a shallow arc with slight spread.
- Ball flight is simulated (gravity, ~90 m effective range); hits detect against an
  oriented box around each hull.
- Damage ~7 ± 2 per ball. Player reload 3.5 s/side; AI slower (5.5 s + jitter).
- Feedback: muzzle flash + smoke, whistling arc, water splash rings on miss, wood-burst
  and hull smoke on hit; ships flash on damage; heavy damage adds deck smoke, then fire.

### 7.2 Ramming / collisions
Ships shoulder each other apart (soft circle collision). No ram damage in v1.

### 7.3 Boarding & capture — the signature mechanic
- Available when: enemy HP < 50 %, distance < ~1 ship length, and you press **BOARD**.
- Both ships strike sails and are winched together; grappling ropes render between hulls.
- A **capture bar** fills at a rate driven by crew ratio:
  `rate ∝ yourCrew / (yourCrew + 1.2 × theirCrew)` — roughly 15–25 s for an even fight.
- During the melee the defender bleeds crew; your crew takes light losses too.
- Cancel any time (cut ropes). If a third ship sinks the prize mid-boarding, it's lost.
- **On capture:** her full gold is yours, ~30 % of her crew turns coat and joins, the ship
  hoists English colors at 55 % HP and joins your fleet.

### 7.4 Sinking
- At 0 HP a ship burns, lists, and goes down over ~5 s.
- A sunk ship spills only **~half her gold** as floating barrels (collect by sailing
  over them; they despawn after 60 s). Boarding is always the greedy play.

## 8. Fleet

- Captured ships sail in a staggered line-astern formation behind the flagship.
- Fleet ships auto-fire their broadsides at enemies that enter their arc/range.
- Fleet panel (top-right): every owned ship with class icon + health bar.
- **If the flagship sinks, you take command of the next ship in the fleet** — the run only
  ends when the last ship is gone.
- Ships slowly self-repair (1 HP/s) after 10 s out of combat.

## 9. Crew

- Little toon sailors (capsule body, head, bandana colors by faction) wander each deck:
  pick a spot, walk, idle, repeat. Visible count scales with actual crew (max 6 rendered).
- During boarding, crews rush to the grappled rail.
- Crew is also a resource: it sets boarding strength; boarding causes casualties;
  captures recruit turncoats.

## 10. Economy & Progression

- **Gold** is the score and the progression axis. Sources: boarding (100 %), flotsam from
  sinkings (~50 %).
- Spanish spawns scale with your gold: early seas are sloops and brigantines; frigates
  appear past ~500 g, galleon traffic thickens past ~1,500 g, ships of the line patrol
  past ~3,000 g. The world keeps ~5 + fleet-size Spanish ships alive, spawning beyond
  the horizon.
- **Victory banner:** hold 10,000 gold *and* a captured Ship of the Line →
  *"Terror of the Spanish Main"* (sandbox continues).
- **Defeat:** last ship of the fleet is sunk → summary screen (gold plundered, ships
  taken, time at sea) + restart.

## 11. AI

**Spanish warships (sloop/brigantine/frigate/ship of the line)**
- *Patrol*: waypoints between islands.
- *Engage* (player fleet within ~140 m): steer to hold the player abeam at 40–80 m,
  fire whichever broadside bears.
- *Flee* at < 30 % HP (except ships of the line, which fight to the end).

**Galleons** run from the player on sight and only return fire with their stern-most
guns when the arc happens to bear. Catching one is a sailing problem, not a DPS check.

## 12. Art Direction — "storybook cel"

- **Toon shading everywhere**: `MeshToonMaterial` with a 3–4 step gradient ramp; single
  warm directional sun + cool hemisphere fill.
- **Outlines**: inverted-hull black outlines on ships, crew and islands (not the sea).
- **Ocean**: custom shader — Gerstner-ish sine swells displaced in the vertex stage,
  fragment stage quantizes height into 3 flat color bands (deep teal → lagoon → light
  crest) with white sparkle flecks and foam caps. The *same* wave function runs in JS to
  float the ships (bob, pitch, roll).
- **Sky**: gradient dome (zenith blue → pale horizon), chunky drifting toon clouds,
  bold low sun. Distance fog fades to the horizon color.
- **Palette**: teal sea `#0e5e78→#3ec6d8`, cream sails `#f4ead2`, warm wood `#8a5a33`,
  English white/red, Spanish gold/crimson, HUD parchment-and-brass.
- **Effects**: flat-shaded smoke puffs, ring-splash decals, expanding foam wakes —
  all shape-and-color, no texture noise.

## 13. UI / HUD

- **Top-left**: flagship plate — name, class, health bar, crew count, **gold total**.
- **Top-right**: fleet list (up to ~8 plates).
- **Bottom-center**: `PORT` fire button ─ sail control (− ▮▮▮ +) ─ `STARBOARD` fire
  button; contextual `BOARD` button floats above.
- **In-world**: ship labels (§6), floating `+250 gold` pickups, edge arrows to
  off-screen enemies.
- **Overlays**: intro/how-to-play card ("Set Sail" starts audio + game), defeat summary,
  victory banner. Serif small-caps typography, parchment tones.

## 14. Audio (procedural WebAudio, no assets)

Cannon boom (filtered noise burst), splash, hull-hit thud, coin chime on pickup,
short fanfare on capture. Ambient sea loop out of scope for v1. Mute toggle in HUD.

## 15. Technical Architecture

- **Stack**: Vite + vanilla ES modules + Three.js. No bundled assets — every model is
  procedural geometry, every texture is a tiny canvas (flags) or a `DataTexture` (toon ramp).
- **Module layout**

```
src/
  main.js                bootstrap, resize, RAF loop (dt clamped to 50 ms)
  game.js                world state: ships[], loot[], boarding, spawning, win/lose
  core/input.js          pointer + touch + keys → intent (steer target, fire, board)
  core/cameraRig.js      smoothed chase camera + zoom
  world/waves.js         wave spec + waveHeight(x,z,t)  ← single source of truth
  world/ocean.js         ocean mesh; GLSL generated from the same wave spec
  world/environment.js   sun, sky dome, clouds, islands (with collision circles)
  ships/factory.js       SHIP_CLASSES + procedural ship meshes, toon/outline helpers
  ships/ship.js          Ship entity: physics, buoyancy, guns, crew figures, sinking
  ai/ai.js               enemy + fleet behaviors
  combat/effects.js      cannonballs, splashes, smoke, wakes, muzzle flashes
  ui/hud.js              HUD buttons/panels, overlays
  ui/labels.js           3D→2D projected ship labels, loot tags, edge arrows
  audio/sound.js         procedural WebAudio SFX
```

- **Simulation**: single-threaded update; ships are kinematic (speed lerps to
  sail target, turn rate scales with speed). Buoyancy samples `waveHeight` at bow/stern/
  port/starboard → y, pitch, roll.
- **Perf budget**: ≤ 15 ships × (~40 outlined toon meshes) + ~200 effect sprites;
  shared geometries/materials; no shadows in v1 (faked with sun angle + bands).
  Target 60 fps on an M-series laptop, 30+ on a mid phone.

## 16. Balancing Reference (v1 numbers)

| Knob | Value |
|---|---|
| Cannonball damage | 7 ± 2 |
| Player / AI reload | 3.5 s / 5.5 s+ |
| Effective gun range | ~90 m |
| Boarding threshold | enemy < 50 % HP, dist < 1 ship length |
| Capture time (even crews) | ~20 s |
| Turncoat rate on capture | 30 % of surviving defenders |
| Flotsam on sink | 50 % of gold in 2–4 barrels |
| Out-of-combat repair | 1 HP/s after 10 s |
| World population | 5 + fleet size Spanish ships |
| Victory | 10,000 gold + own a Ship of the Line |

## 17. Out of Scope (roadmap)

Storms & day/night · named bounty captains · captain character selection · sound
ambience/music · gamepad · multiplayer · saving between sessions · chain/grape shot
ammunition types.

## 18. Version 1.1 — "The Family Update"

Added from the first family playtest:

- **Faster sailing** — every class ~35% faster, sharper turning.
- **Wind** — a global wind slowly veers around the compass (clouds drift with it).
  Sailing with the wind is up to +35% speed, against it −35%. A **wind dial** at the
  top of the HUD points where the wind blows relative to your heading and glows
  green (fair) or red (foul).
- **Command any ship** — tap any ship in the fleet panel to make her your flagship
  (or cycle with `C`). The camera, HUD and helm follow.
- **Fleet orders** — every other ship is either **⚑ Follow** (formation, assists your
  fights, adds crew weight to your boarding melees within 45 m) or **⚔ Hunt**
  (roams free: chases, guns down and *autonomously boards* Spanish ships; her
  prizes join the fleet with her orders). **📣 All follow me** recalls everyone.
- **Anchoring & shore leave** — slow down near any island and **⚓ Drop Anchor**: a
  shore party rows in and wanders the beach, the ship repairs at 3.5 HP/s and
  recruits trickle back aboard.
- **Port town** — one island holds a walled-off town (houses, watchtower, dock),
  marked with a gold ⚓ on the minimap. The Spanish never attack inside the
  harbor. The **Port Royal Market** sells (one-time unless noted):
  | Item | Cost | Effect |
  |---|---|---|
  | Carronades | 800 | +40% broadside damage (fleet-wide) |
  | Long Nines | 600 | +25% shot speed/range |
  | Double-Shot Racks | 1200 | two balls per gun |
  | Live Oak Hulls | 700 | +30% max HP, fleet-wide incl. future prizes |
  | Hire Hands | 150 (repeatable) | +10 flagship crew |
  | Careen & Repair | 100 (repeatable) | full fleet repair |
- **Minimap** — round chart, bottom-right: islands, the port, flotsam, every ship
  (white = yours, red = Spanish warship, gold = galleon), flagship as a heading
  triangle.
- **Deck-level zoom** — camera now zooms in close enough to watch your crew.

## 19½. Version 1.3 — "The Thirsty Parrot Update"

Built overnight from the family wishlist ("make it super fun, add ocean sounds, a
tavern with games, a visible captain"):

- **A living soundscape** — endless procedural sea-swell ambience, gull cries near
  land, rigging creaks under way, sword-clank boarding melees, and a proper mute.
- **The captain walks his deck** — tricorn, feather, parrot and all, on whatever
  ship you command. Tap him for a salty line; tap the parrot for a squawk. Works
  ashore too.
- **The Thirsty Parrot tavern** at the port (red roof, lanterns, a parrot on the
  sign). The galley sells *gameplay*: Coconut Fizz (+15% fleet speed, 90 s), Hot
  Fish Stew (3× repairs, 90 s), Plum Duff (+3 crew) — all resolutely alcohol-free.
- **Ship, Captain & Crew** — the real pirate dice game, against One-Eyed Meg.
  Three rolls to lock ⚅ ship, ⚄ captain, ⚃ crew, in order; the last two dice are
  cargo; highest cargo takes the pot. Stake 25/100/500 gold — or **bet a ship**:
  Meg matches your hull with one of hers. Win and it anchors off the port; lose
  and she sails yours away under her own colors.
- **Treasure maps** (150 g at the tavern) — a red ✕ appears on the minimap and
  crossed planks on a random island. Walk your captain onto the spot, hit **DIG**,
  and a chest rises with 400–900 gold.
- **Wildlife** — seagulls wheel over every island; dolphin pods leap across your
  bow with splashes and chirps.
- **Governor's Bounty Board** — one bounty at a time, posted at the tavern:
  sink or capture specific classes, or dig up a treasure. Progress is tracked
  live under the wind dial; the Governor pays on completion. Gives every
  session a "what's next".
- **Sharper combat feel** — camera shake when your flagship is hit, hulls under
  40 % health wallow at ¾ speed, and once you hold 800+ gold, Spanish hunter
  frigates (with fattened pay chests) spawn on your trail every ~5 minutes.

## 19. Version 1.2 — "The Shore Party Update"

- **One FIRE button** — port/starboard buttons replaced by a single 🔥 FIRE
  (or Space) that lets fly *both* broadsides; reload cut to 2.2 s, and every
  class sails ~20% faster still.
- **Round world** — sail off the edge of the chart and you emerge on the
  opposite side, camera gliding through the seam. No walls, no borders.
- **Going ashore in person** — while anchored, tap **🚶 Go Ashore**: your
  captain and two hands row in on a little jolly boat (chase-camera
  cinematic), beach the boat, and then you walk the island in **third person**
  — hold the pointer to walk toward it (or W/A/S/D), climb the hills for the
  view. **⛵ Return to Ship** rows you back.
- **The captain himself** — red coat, black tricorn with a gold band and
  feather, and a **parrot on his shoulder**. Tap the parrot and it plays one
  of three real parrot recordings (`public/sounds/parrot-*.wav`) — "Pieces of
  eight!", "Pretty boy!", and an inquisitive squawk — picked at random, never
  the same twice in a row, through the WebAudio mixer (so the mute button
  applies). The procedural screech remains as a fallback if a clip fails to
  load. This is the game's one exception to "everything procedural".
- **Walk into the market** — at the port town the middle house hangs a gold
  sign and stacks barrels out front; walk up to its door and **🛒 Enter the
  Market** opens the shop. Buildings have collision — no ghosting through
  walls.
