# V3 ENGINE — MODULE CONTRACT

All agents MUST read this file before writing code. Do not modify files outside your assignment.
CommonJS modules (`module.exports = ...`). Node 24. No external deps.

## Shared conventions
- Full cell ID format: `"L1-C4"` — level prefix `L0`/`L1`, column `A`–`F`, row `1`–`5`.
- Short cell ID: `"C4"`.
- Door key: sorted full IDs joined by `|`, e.g. `"L1-C3|L1-D4"`.
- Edges: `[cellA, cellB, type, widthMetres]` where type ∈ `open|door|glass|wall`.
- CELL_M = 4.
- Directions: row 5 is NORTH, row 1 is SOUTH. In map coordinates y = row-1, so increasing y = north.
  `DIRS = {N:{x:0,y:1}, S:{x:0,y:-1}, E:{x:1,y:0}, W:{x:-1,y:0}}`

## engine/rng.js — ALREADY WRITTEN. Do not modify.
`require('./rng')` → `{ d100(label,target,context), jitter(label,spread) }`
d100 returns `{ts,label,target,roll,margin,verdict,grade,context}` where grade ∈
`CRITICAL_FAIL | FAIL | SUCCESS | CRITICAL_SUCCESS` (margin<=-20, <0, <20, else).
jitter is deterministic hash → integer in [-spread, spread].

---

## AGENT 1 — engine/map.js
`require('./map')` → `makeMap(def)` returning an object:
- `.def` — the raw definition
- `.cells` — `{ "L1-C4": {m,n,level,x,y} }`
- `.doors` — `{ key: state }` state ∈ `open|closed|locked`, initialized from `def.doors`
- `.setDoor(key,state)` / `.getDoor(key)`
- `.edgeType(a,b)` → type string or `null` (null = solid wall / no edge)
- `.edgeWidth(a,b)` → metres (default 0.9 for doors, 4 for open, 0 otherwise)
- `.neighbors(id)` → `[{id,type}]` for all 4 orthogonal neighbours that exist in `.cells`
- `.dist(a,b)` → Euclidean distance in cells
- `.xy(id)` → `{x,y}`
- `.los(a,b,opts)` → `{clear,walls,doors,glass,steps:[{from,to,type}]}`.
  `opts.openDoors` is a Set of door keys treated passable. A door counts as `doors` (blocking)
  unless its key is in `opts.openDoors` OR `.doors[key]==='open'`. Glass allows sight (not blocking).
  Diagonal steps require BOTH orthogonal edges passable, else count as wall.
- `.path(a,b,opts)` → `[fullIds]` shortest path or `null`. Traverse `open` and `door` edges
  (ANY door is passable for NPC movement), NOT `glass`, NOT `null`. Use BFS.
- `.level(id)` → `"L0"|"L1"`
- `.material(id)` → material string
- `.roomName(id)` → name string
Must handle short ids defensively (normalize to full with level).

## AGENT 1 — engine/physics.js
`require('./physics')` → `{ MATERIAL, lightAt, audible, localize, falloff }`
- `MATERIAL` map: marble:8, tile:5, concrete:3, gravel:2, wood:0, asphalt:0, stone:1,
  grass:-4, dirt:-3, rock:1, hedge:-6, glass:2, water:-2, carpet:-5
- `lightAt(map,cell,lights,env)` → number. Normalize short ids. ambient from `env.ambientDb`?
  NO — ambient light comes from the map def's `ambient` field passed via env.ambientLight.
  Lights: `{id,cell,radius,intensity,on,facing}`. Directional cone: if facing set and dot<0.2, ×0.25.
  If env.breaker==='off' and level==='L1', cap L at 0.8.
- `audible(map,listener,snd,env,openDoors)` → `{heard,level,margin,dcells,occlusion}`.
  source dB = snd.db + MATERIAL[material(snd.cell)].
  occlusion = walls*8 + closedDoors*10 + glass*2 via map.los(snd.cell,listener,{openDoors}).
  loss = 20*log10(max(1,dcells*4)) + occlusion + (snd.occlusion||0).
  ambientDb from env.ambientDb (default 32), minus 4 if env.rain is false.
  heard = level > ambient.
- `localize(npcsId,snd,aud,map)` → believed cell string. If aud.dcells===0 return exact.
  If aud.margin>14 return exact. Else ONE cell of deterministic jitter via rng.jitter(label,1).

---

## AGENT 2 — engine/ledger.js
`require('./ledger')` → `makeLedger(initial)` returning:
- `.has(id)` → boolean
- `.resolveOnce(id,fn,context)` → if id already resolved returns `{fired:false,result:null}`;
  else calls fn(context), marks resolved, returns `{fired:true,result}`.
- `.resolve(id,result)` — mark resolved with result
- `.unresolved()` → array of ids
- `.dump()` → plain object
- `.load(obj)` — restore state
This fixes "events re-fire every turn".

## AGENT 2 — engine/heat.js
`require('./heat')` → `makeHeat(opts)` with opts `{decay:1, thresholds:[{at:10,event:'checkin'},{at:35,event:'sweep'},{at:70,event:'lockdown'}]}`
- `.add(cell,amount,reason)` — add heat to cell AND global
- `.tick()` — decay all by opts.decay, return array of fired threshold events
  `{event,cell?,level,reason}`; thresholds fire ONCE per crossing (track fired set), reset when heat drops below threshold*0.6.
- `.level(cell)` → number; `.global()` → number
- `.status()` → `{global,cells:{...},fired:[...]}`
- `.load(obj)/.dump()`

## AGENT 2 — engine/missionstate.js
`require('./missionstate')` → `makeMission(def)` finite state machine.
States: BRIEFING, INFILTRATION, OBJECTIVE, EXTRACTION, COMPLETE, COMPROMISED.
- `.state` getter
- `.advance(event)` — event names: `START`, `ENTER`, `OBJECTIVE_DONE`, `EXTRACT`, `COMPLETE`, `FAIL`.
  Valid transitions: BRIEFING→INFILTRATION (START), INFILTRATION→OBJECTIVE (ENTER),
  OBJECTIVE→EXTRACTION (OBJECTIVE_DONE), EXTRACTION→COMPLETE (COMPLETE),
  any→COMPROMISED (FAIL). Invalid transitions return false and log.
- `.history` array of `{from,to,event,ts}`
- `.isActive()` → boolean
- `.dump()/.load(obj)`

## AGENT 2 — engine/account.js
`require('./account')` → `makeAccount(data)` persisted operator profile.
- `.credits`, `.reputation`, `.gear` (array of item ids), `.missions` (array of records), `.kills`
- `.buy(itemId,catalog)` — deduct credits if affordable, add to gear, return result
- `.canAfford(cost)`
- `.recordMission(record)` — push {id,result,time,kills,creditsEarned}
- `.applyResult({success,kills,credits,rep})`
- `.dump()/.load(obj)`
- Default: credits 25000, reputation 50, gear ['knife','lockpick'].

---

## AGENT 3 — content/items.js
`require('./items')` → `ITEMS` object keyed by id. At least 24 items across categories:
firearms, melee, tools, electronics, consumables, support.
Each: `{id,name,cost,category,specs:[string,string,string],timeCost,noise,weight}`.
`timeCost` in seconds for using it, `noise` in dB, `weight` kg. Be realistic.
Include: pistol (suppressed, 9mm), revolver(no casing), smg, rifle, knife, garrote,
baton, lockpick, bypass, cutters, climb rig, door wedge, jammer, decoder, fibercam,
decoy, gas, flashbang, thermite, medkit, bodybag, ghillie, gloves, booties, tracekit, radio.

## AGENT 3 — content/maps.js
`require('./maps')` → `MAPS` object with at least 3 distinct maps, each a valid map def:
`{name,ambient,cells:{shortId:{m,n}},edges:[[a,b,type,width]],lights:[...],doors:{key:state}}`
Must use 6x5 grids (A–F, rows 1–5). Every cell short id valid. Every adjacent pair either
declared as edge or intended solid wall. Include realistic windows (glass edges), doors with
widths, and lights. Maps:
1. `transit` — "MERIDIAN TRANSIT HUB" — a train station concourse + service levels.
2. `archive` — "HALCYON ARCHIVE" — records vault (reuse the refined v2 layout concept).
3. `safehouse` — "THE GLASSHOUSE" — a coastal safehouse with a cliff extraction.
Each must be traversable: provide at least one path from an insertion cell to an objective cell.

## AGENT 3 — content/campaign.js
`require('./campaign')` → `CAMPAIGN` object:
```
{
  title:'THE QUIET LEDGER',
  story:'...', // 2-3 paragraphs of connected narrative
  missions:[
    {id,name,brief,mapId,insert:{cell,facing,posture},
     enemies:[{id,name,role,cell,facing,range,weapon,patrol?,traits?}],
     cameras:[{id,name,cell,facing,fov,range,ir,monitor,monitorPost,attention,pan?}],
     intel:{...}, objectives:[{id,type,target,desc}], // type: eliminate|copy|extract|survive|deactivate
     deadline:seconds, exit:{cell}, rewards:{credits,reputation}}
  ]
}
```
Three missions forming one arc: steal a manifest → silence the auditor → extract the asset.
Give each mission 5–9 enemies with varied roles (guard/bodyguard/courier/target/technician),
2–4 cameras, real objectives, a deadline, and an exit cell. Make it a proper story with twists.

---

## AGENT 4 — engine/brain.js
`require('./brain')` → `{ decideAll }`
`decideAll(world, beliefs, positions, map, rng, heat)` → `{decisions:{}, trace:[]}`
Each decision: `{mode,target,facing,radio,priority,delay,reason}`.
Role policies with DISTINCT behavior:
- guard: see intruder→alert+radio; radio report→search; evidence→alert+radio;
  gunshot→hard alert (no curiosity roll); other sound→d100 vs curiosity; suspicion≥2→sweep;
  otherwise patrol route.
- bodyguard: stay within 1 cell of principal; threat→shield (move to principal); NEVER leave
  principal to investigate a mere noise; radio 'close protection'.
- courier: hold package; threat→flee to safe cell or freeze on nerve roll; never engage.
- target: compose; threat→panic (radio abort, move to safe room) or freeze on nerve roll;
  never investigate.
- technician: stays at workstation; on alarm→lockdown (radio), stays put.
Use traits with defaults per role: guard{alertness60,curiosity55,nerve60,discipline70},
bodyguard{80,15,75,90}, courier{45,20,40,40}, target{35,10,30,30}, technician{50,25,55,80}.
Delay via d100 vs nerve: failure → 3s hesitation. Gunshots bypass curiosity entirely.
Trace lines must be readable, e.g. `"S2 (guard) @ SECURITY DESK: alert → READING ROOM"`.
Use `rng.d100(label,target)` for all rolls. Use map.dist and map.los where needed.

---

## I will write (do NOT create these):
engine/engine.js, engine/world.js, engine/player.js, run.js, test/harness.js,
test/scenarios.js, ui/index.html, README.md, package.json.

## Rules for all agents
- Write ONLY your assigned files.
- Use `require('./rng')` style relative paths from within engine/ or content/.
- Export cleanly. No console.log on import.
- Keep functions pure where possible.
- Validate your modules with `node -e "require('./...')"` before finishing.
- Report briefly: which files you wrote and any assumption you made.
