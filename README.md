# Stealth Engine v3 — THE QUIET LEDGER

A complete rewrite after v2's review. Three-mission campaign, mission state machine,
persistent account, role-specific NPC brains, and every gap from the v2 post-mortem
fixed and **tested**.

## Repo
Private: https://github.com/Eyeffect/stealth-engine-v3

## Run

```bash
cd game/v3
node run.js view m1_manifest          # inspect player view
node run.js act m1_manifest '{"type":"wait","seconds":6}'
node test/harness.js                  # 37 invariant tests
node test/playthrough.js              # auto-plays all 3 missions to COMPLETE
node test/adversarial.js              # 11 adversarial edge-case tests
node ui/export.js m2_auditor          # write ui/snapshot.json for the GUI
```

GUI: serve `ui/` over HTTP (`python -m http.server`) and open `index.html`.
Append `?gm` for the GM diagnostic tab. Browsers block `fetch` on `file://`.

## What's fixed from v2

| v2 failure | v3 fix | Test |
|---|---|---|
| Invented rolls | `engine/rng.js` audits every d100 to `audit.log` | all suites |
| Events re-fired | `engine/ledger.js` `resolveOnce` wired into engine | harness |
| Time advanced arbitrarily | action cost table (`timeCost` per action) | harness |
| Player could not be hurt | hostile fire damages HP, adds wounds, raises sway | harness |
| Aim sway was decorative | sway folded into shot hit chance | adversarial |
| Body-blocking missing | `shoot()` walks `map.path`, first body takes round | harness |
| Gunshot treated as curiosity | `gunshotHeard` hard alert in brain | harness |
| Heat never escalated | `engine/heat.js` thresholds → CHECKIN/SWEEP/LOCKDOWN | adversarial |
| Dead guards still moved | brain returns `down`, movement skipped | harness |
| Fog of war leaked | `playerView()` has no GM keys | harness |
| Mission never completed | FSM BRIEFING→INFILTRATION→OBJECTIVE→EXTRACTION→COMPLETE | playthrough |
| Dead-man trigger was flavor | real 90s timer, disarmable, fires on failure | adversarial |
| Guards all shared a brain | 5 role policies with distinct traits and behavior | harness |
| Two sources of truth for positions | single `world.positions` | harness |

## Architecture

- `engine/rng.js` — audited d100 with graded results
- `engine/map.js` — grid, LOS, pathfinding, doors (agent-built, validated)
- `engine/physics.js` — light, sound, occlusion, localization (agent-built)
- `engine/ledger.js` — resolve-once event registry
- `engine/heat.js` — escalation with hysteresis
- `engine/missionstate.js` — mission FSM
- `engine/account.js` — persistent operator profile
- `engine/brain.js` — 5 role policies (guard/bodyguard/courier/target/technician)
- `engine/engine.js` — turn resolver tying it all together
- `content/` — 3 maps, 29 items, 3-mission campaign
- `test/` — harness, playthrough, adversarial suites
- `ui/` — browser client + snapshot exporter

Information tiers: `world` is truth; `beliefs` are per-NPC local knowledge;
`playerView()` is the only thing the player sees; `diagnostics()` is GM-only.

## Campaign

**THE QUIET LEDGER.** A corrupt intelligence network is selling a manifest of
active assets. Three missions: steal the manifest at Meridian Transit Hub,
silence the auditor in the Halcyon Records Vault, extract the asset from the
Glasshouse safehouse before the cleanup team arrives. Twist: the "asset" is the
auditor you were paid to kill, and your handler authored the ledger.
