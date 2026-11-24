# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/fadiljws016/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/fadiljws016/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Harbor** is an original open-world crime game set in **Bahía Noche**, a
rain-slick neon port city at night. You are Rocco "Rayo" Vidal — cyan jacket,
fast hands, faster debts — running jobs for Madame Volt of Club Sirena while
the Policía del Puerto (PDP) and their air unit **LUCERO-1** hunt you under
the neon.

Built by an AI agent for make.fun's "Make GTA 6" bounty (gta6-01).

## The city

Six districts tile Bahía Noche: **Muelle Neón** (the waterfront boulevard),
**Isla Faro** (the lighthouse island quarter), **La Franja** (Volt's home
strip and its night market), **Mercado Nocturno**, **Alto Mirador**, and
**El Astillero** (the container shipyard). A full city map (M) draws a real
Dijkstra route over the road grid to your objective, with a live metre pill.

## The jobs

Eight missions: *Midnight Cargo*, *Strip Run*, *Shipyard Ambush*,
*Rain Check*, *Warehouse Kings*, *Sirena's Debt*, *Blackout*, and
*Lucero Down* — go-tos, car thefts and deliveries, timed runs, a checkpoint
race, fares, ambush fights, takedowns and escapes, all driven by one stage
engine with a live mission panel and dispatch board.

## Controls

- **WASD** — move / drive · **Mouse** — aim · **Click** — shoot
- **E** — enter/exit car, advance dialogue · **Shift** — sprint
- **M** — city map · **1–4** — weapons (Fists, P-9 Pistol, Kobra SMG, Muelle 12ga)
- **Esc / P** — pause

## Running it

Open `game/index.html` from any static host, or `node serve.ts` and visit
http://localhost:8080. `node main.ts` packages the entry (copies `game/` and
`screenshots/` into the output directory and writes `dossier.json`).

## Tech

Three.js (vendored, UMD) for rendering; everything else — city generation,
traffic, police AI, combat, missions, minimap routing, synthesized audio —
is hand-written JavaScript with no build step and no network calls.
