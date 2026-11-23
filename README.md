# DOTBOX · 20 IN 1

A Progressive Web App pocket LCD handheld featuring **20 classic monochrome games**, 4-channel Game Boy chiptune music, daily challenges, and offline play.

**Play live:** https://ipaliog-a11y.github.io/handheld_g/

![DOTBOX](icon-512.png)

## Games

| | Game | What you do |
|---|------|-------------|
| ★ | **DAILY** | Today's game, same level, speed and random sequence for everyone |
| A | **BRICK** | Classic falling bricks: hold piece, ghost preview, combos |
| B | **BRICK B** | Falling bricks starting with garbage rows |
| C | **RACE** | Dodge the cars in three lanes |
| D | **SNAKE** | Eat and grow |
| E | **SHOOT** | Clear the descending blocks |
| F | **TANK** | Tank battle |
| G | **BREAK** | Brick breaker |
| H | **FROG** | Cross the road and the river |
| I | **STACK** | Stop the sliding row on top of the one below |
| J | **RUNNER** | Jump over blocks, duck under birds |
| K | **FILL** | Shoot blocks up to complete the rows creeping down |
| L | **PONG** | Paddle vs CPU |
| M | **INVADE** | Stop the marching aliens |
| N | **GEMS** | Match 3+ falling gems in any direction |
| O | **MAZE** | Eat all the dots, avoid the chasers |
| P | **RALLY** | Two-lane racing with fuel and turbo |
| Q | **CLIMB** | Tower jumper across solid, moving, crumbling and spring ledges |
| R | **DIGGER** | Dig tunnels, collect gems, drop boulders on monsters |
| S | **BOXES** | Sokoban warehouse crate puzzles with undo and retry |
| T | **MEMORY** | Repeat growing light-and-tone sequences |

## Features

- 20 classic handheld games + **Daily Challenge**, stats page and 13 awards
- Authentic handheld shell + LCD look, 5 colour themes (classic, green, grey, amber, blue)
- Level (1–9) + Speed (1–9) select
- Top-5 high score table per game with initials, plus a **Share** button on game over
- Touch, swipe, keyboard and **gamepad** controls
- Portrait and landscape layouts
- 4-channel Game Boy DMG-01 chiptune soundtrack + pulse/noise SFX and adjustable haptic intensity
- Full offline PWA (installable on phone)
- English + Greek language

## Controls

| Input | Action |
|-------|--------|
| D-pad / WASD / Arrows | Move / steer / menus |
| A button / Z / J | Rotate / fire / jump / OK (shown on the button) |
| B button / X / K | Drop / fire / back (shown on the button) |
| ▲ / C / Shift (brick games) | Hold piece |
| START / Enter / Space | Start / pause menu / confirm |
| SET / O / , | Settings (also from the pause menu) |
| RESET / R | Back to menu |
| SOUND / M | Toggle sound |
| Esc / P | Pause |

**Swipe** on the screen: drag to move, tap = A, flick down = hard drop in brick games.

**Gamepad:** d-pad/stick, A/Y = A, B/X = B, Start, Select = settings, shoulders = hold.

### Settings (SET button)

| Option | Description |
|--------|-------------|
| **BIG 3** | Large Down/Left/Right buttons while playing (touch-friendly). Default OFF |
| **REPEAT** | Hold a button to auto-repeat |
| **GHOST** | Landing preview of the falling piece |
| **THEME** | LCD colour theme |
| **SWIPE** | Swipe/tap controls on the screen |
| **BUZZ** | Haptic vibration intensity (`OFF` / `LOW` / `MED` / `HIGH`) |
| **SOUND** | Master sound on/off |
| **MUSIC** | Game Boy chiptune background music on/off |
| **LANG** | English / Ελληνικά |

## Install as app (phone)

1. Open the live link in Chrome / Safari
2. Tap **Add to Home Screen** / **Install**
3. Launch like a native app (fullscreen, offline)

## Tech

- Single-file HTML + Canvas, vanilla JS (no frameworks)
- Service Worker for offline (bump `CACHE_NAME` in `sw.js` when changing files)
- `localStorage` for scores, stats and settings
- VT323 pixel font

## Development

Open `index.html` or serve the folder:

```bash
npx serve .
```

Run the end-to-end tests (headless Chromium):

```bash
npm install
npx playwright install chromium
npm test
```

The tests also run on every push and pull request via GitHub Actions.

## License

MIT – made for fun and nostalgia.
