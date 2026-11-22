// ui/export.js — boot a v3 mission in Node and write a browser-readable snapshot.
// Usage:  node ui/export.js [missionId]        (default: m1_manifest)
// Output: ui/snapshot.json
'use strict';

const fs = require('fs');
const path = require('path');

const { makeEngine } = require('../engine/engine');
const { makeWorld } = require('../engine/world');
const { makeAccount } = require('../engine/account');
const { CAMPAIGN } = require('../content/campaign');
const { ITEMS } = require('../content/items');

const missionId = process.argv[2] || 'm1_manifest';

// ---- boot ---- load the persistent live account if present ----
const LIVE = path.join(__dirname, '..', 'live.json');
const acct = fs.existsSync(LIVE) ? makeAccount(JSON.parse(fs.readFileSync(LIVE, 'utf8'))) : makeAccount();
const { world, mapDef, mission } = makeWorld(missionId, acct);
const eng = makeEngine({ world, mapDef, ambientDb: 32, rain: false, heatDecay: 1 });

// Nudge the finite state machine out of BRIEFING so the snapshot shows a live
// mission state, exactly as the first real turn would.
eng.turn({ type: 'wait', seconds: 0, desc: 'snapshot boot' });

const view = eng.playerView();
const diag = eng.diagnostics();

// ---- action catalogue (what the operator can compose in the GUI) ----
const ACTION_HELP = {
  move:       { label: 'MOVE',       hint: 'Move to a cell; short id (B1) or full id (L0-B1).',        template: { type: 'move', cell: 'B1' } },
  crouch:     { label: 'CROUCH',     hint: 'Drop to crouched posture (lower sight score).',            template: { type: 'crouch' } },
  stand:      { label: 'STAND',      hint: 'Return to standing posture.',                              template: { type: 'stand' } },
  openDoor:   { label: 'OPEN DOOR',  hint: 'key = sorted full ids "L0-A1|L0-B1", or an adjacent cell.', template: { type: 'openDoor', key: 'L0-A1|L0-B1' } },
  closeDoor:  { label: 'CLOSE DOOR', hint: 'Close a door using the same key format.',                  template: { type: 'closeDoor', key: 'L0-A1|L0-B1' } },
  wedge:      { label: 'WEDGE',      hint: 'Jam a door open with a wedge.',                            template: { type: 'wedge', key: 'L0-A1|L0-B1' } },
  shoot:      { label: 'SHOOT',      hint: 'target = npc id; aim = center | head | leg.',              template: { type: 'shoot', target: 'T-01', aim: 'center' } },
  copy:       { label: 'COPY',       hint: 'Copy data in your current cell.',                          template: { type: 'copy' } },
  deactivate: { label: 'DEACTIVATE', hint: 'Disable an alarm/relay in your current cell.',             template: { type: 'deactivate' } },
  search:     { label: 'SEARCH',     hint: 'id = downed npc id, in the same cell.',                    template: { type: 'search', id: 'T-01' } },
  drag:       { label: 'DRAG',       hint: 'id = downed npc id; to = destination cell.',              template: { type: 'drag', id: 'T-01', to: 'A1' } },
  radio:      { label: 'RADIO',      hint: 'text = transmission; optional channel.',                  template: { type: 'radio', text: 'All clear.' } },
  don:        { label: 'DON MASK',   hint: 'Put on the respirator mask (60 s filter).',               template: { type: 'don', mask: 'gasmask' } },
  gas:        { label: 'GAS',        hint: 'Release a tranquilizer gas cloud in a cell.',             template: { type: 'gas', cell: 'D3' } },
  wait:       { label: 'WAIT',       hint: 'seconds = time to let the world run.',                     template: { type: 'wait', seconds: 6 } }
};
const actions = eng.actions.map(t => Object.assign({ type: t }, ACTION_HELP[t] || {
  label: t.toUpperCase(), hint: '', template: { type: t }
}));

// ---- assemble snapshot ----
const snapshot = {
  generatedAt: new Date().toISOString(),
  exporterVersion: 1,
  missionId: mission.id,
  campaign: { title: CAMPAIGN.title, story: CAMPAIGN.story },
  mission: {
    id: mission.id,
    name: mission.name,
    brief: mission.brief,
    mapId: mission.mapId,
    deadline: mission.deadline,
    exit: mission.exit,
    rewards: mission.rewards,
    enemies: mission.enemies || [],
    cameras: mission.cameras || [],
    intel: mission.intel || {},
    objectives: (mission.objectives || []).map(o => Object.assign({}, o))
  },
  mapEdges: mapDef.edges || [],
  map: {
    name: mapDef.name,
    level: world.level || 'L0',
    ambient: mapDef.ambient,
    cells: eng.map.cells,
    edges: mapDef.edges || [],
    doors: eng.map.doors,
    lights: mapDef.lights || []
  },
  view,
  overlays: eng.overlays(),
  diagnostics: diag,
  contacts: view.contacts,
  account: acct.dump(),
  items: ITEMS,
  actions
};

const outDir = __dirname;
const outFile = path.join(outDir, 'snapshot.json');
fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('Wrote ' + outFile + ' — ' + mission.id + ' (' + view.mission + ', clock ' + view.clock + 's, heat ' + view.heat + ')');
