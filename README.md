# Neon Harbor

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fadiljws016/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fadiljws016/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in **Bahía Noche**, a rain-slick neon
port city that never sees daylight. You are Rocco "Rayo" Vidal, a dock
courier running packages for Madame Volt of Club Sirena — while Bruno the
crane boss, the mysterious La Sombra, and the Policía del Puerto (with
their LUCERO-1 searchlight helicopter) all close in on the harbour.

Eight story jobs — cargo runs, a strip race, a shipyard ambush, night
fares, warehouse takedowns, a stolen police cruiser, a blackout run and a
final stand under the cranes — across six districts, with a wanted system,
pursuit AI, a live dispatch feed, a painted city map with real routed
navigation, and a full day-one arsenal: fists, the P-9 Pistol, the Kobra
SMG and the Muelle 12ga.

## Districts

- **Muelle Neón** — the west waterfront: quay, marina berths, the garage
- **La Franja** — the neon strip: Club Sirena, Bar Órbita, Hotel Luna
- **Mercado Nocturno** — the night market sheds of the north-east
- **El Astillero** — the south docks: container yard and gantry cranes
- **Isla Faro** — the lighthouse point
- **Alto Mirador** — the eastern heights

## Controls

- **WASD** — move / drive · **Shift** — run
- **E** — talk, enter/exit a car, work a job point
- **Mouse click** — fire · **1–4** — weapon slots
- **M / ESC** — full city map

## Running it

Open `game/index.html` in a desktop browser — everything is static and
self-contained (Three.js is vendored; there are no network requests).
`main.ts` is the make.fun entry builder: it copies `game/` and
`screenshots/` into `MAKEFUN_OUTPUT_DIR` and writes the dossier.
