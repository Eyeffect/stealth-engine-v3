// content/maps.js — three 6x5 stealth maps for THE QUIET LEDGER.
// Cell ids are short (A1..F5); edges/doors/lights use full ids (L0-A1).
'use strict';

// Edge shorthand: E('A1','B1','door',0.9) -> ['L0-A1','L0-B1','door',0.9]
function E(a, b, type, width) {
  return ['L0-' + a, 'L0-' + b, type, width];
}
// Door-key shorthand: sorted full ids joined by '|'.
function D(a, b, state) {
  var k = ['L0-' + a, 'L0-' + b].sort().join('|');
  var o = {};
  o[k] = state;
  return o;
}
function doorsFrom(list) {
  var out = {};
  list.forEach(function (t) {
    var k = ['L0-' + t[0], 'L0-' + t[1]].sort().join('|');
    out[k] = t[2];
  });
  return out;
}
// Build {shortId:{m,n}} from 5 rows (row 1 first = south), 6 cells each.
function grid(rows) {
  var out = {};
  for (var r = 0; r < rows.length; r++) {
    for (var c = 0; c < 6; c++) {
      out[String.fromCharCode(65 + c) + (r + 1)] = { m: rows[r][c][0], n: rows[r][c][1] };
    }
  }
  return out;
}
// A Hamiltonian snake that visits all 30 cells; guarantees full open/door connectivity.
var SNAKE = [
  ['A1','B1'],['B1','C1'],['C1','D1'],['D1','E1'],['E1','F1'],
  ['F1','F2'],['F2','E2'],['E2','D2'],['D2','C2'],['C2','B2'],
  ['B2','A2'],['A2','A3'],['A3','B3'],['B3','C3'],['C3','D3'],
  ['D3','E3'],['E3','F3'],['F3','F4'],['F4','E4'],['E4','D4'],
  ['D4','C4'],['C4','B4'],['B4','A4'],['A4','A5'],['A5','B5'],
  ['B5','C5'],['C5','D5'],['D5','E5'],['E5','F5']
];
function snakeEdges(overrides) {
  overrides = overrides || {};
  return SNAKE.map(function (p, i) {
    var o = overrides[i] || ['open', 4];
    return E(p[0], p[1], o[0], o[1]);
  });
}

// ============================================================
// 1. MERIDIAN TRANSIT HUB
// ============================================================
var transit = {
  name: 'MERIDIAN TRANSIT HUB',
  ambient: 0.30,
  cells: grid([
    [['concrete','Service Tunnel'],['concrete','Loading Bay'],['tile','Baggage Claim'],['marble','Main Concourse'],['marble','Main Concourse'],['concrete','East Platform']],
    [['concrete','Service Tunnel'],['tile','Staff Corridor'],['tile','Ticket Hall'],['marble','Main Concourse'],['marble','East Concourse'],['concrete','Platform 2']],
    [['concrete','Utility Room'],['tile','Restrooms'],['carpet','Parcel Office'],['carpet','Parcel Office'],['tile','Information Desk'],['concrete','Platform 3']],
    [['concrete','Service Lift'],['wood','Storage'],['concrete','Service Bay'],['concrete','Service Bay'],['tile','Signal Control'],['concrete','East Walkway']],
    [['concrete','Vent Shaft'],['concrete','Roof Access'],['concrete','Cable Run'],['concrete','Cable Run'],['tile','Signal Room'],['gravel','North Overlook']]
  ]),
  edges: snakeEdges({ 2: ['door',1.8], 6: ['door',1.8], 14: ['door',0.9], 19: ['door',3.0] }).concat([
    E('A1','A2','open',4), E('B1','B2','door',0.9), E('C1','C2','open',4),
    E('D1','D2','open',4), E('E1','E2','open',4),
    E('B2','B3','glass',0.1), E('C2','C3','door',0.9), E('D2','D3','open',4),
    E('E2','E3','open',4), E('F2','F3','glass',0.1),
    E('A3','A4','open',4), E('B3','B4','open',4), E('C3','C4','open',4),
    E('D3','D4','door',0.9), E('E3','E4','open',4),
    E('B4','B5','open',4), E('C4','C5','open',4), E('D4','D5','open',4),
    E('E4','E5','glass',0.1), E('F4','F5','open',4)
  ]),
  lights: [
    { id:'T-L1', cell:'L0-C2', radius:3, intensity:1.0, on:true, facing:'S' },
    { id:'T-L2', cell:'L0-D3', radius:2, intensity:0.8, on:true },
    { id:'T-L3', cell:'L0-B4', radius:3, intensity:0.6, on:true, facing:'N' },
    { id:'T-L4', cell:'L0-F2', radius:2, intensity:0.5, on:false },
    { id:'T-L5', cell:'L0-E4', radius:3, intensity:1.1, on:true }
  ],
  doors: doorsFrom([
    ['C1','D1','open'], ['F2','E2','closed'], ['C3','D3','locked'],
    ['E4','D4','open'], ['B1','B2','closed'], ['C2','C3','closed'], ['D3','D4','closed']
  ])
};

// ============================================================
// 2. HALCYON ARCHIVE
// ============================================================
var archive = {
  name: 'HALCYON ARCHIVE',
  ambient: 0.18,
  cells: grid([
    [['concrete','Loading Dock'],['tile','Sorting Room'],['marble','Front Lobby'],['marble','Front Lobby'],['marble','Catalogue Hall'],['tile','Staff Entrance']],
    [['concrete','Loading Ramp'],['tile','Sorting Room'],['tile','Catalogue Hall'],['marble','Reading Room'],['marble','Reading Room'],['tile','Staff Corridor']],
    [['concrete','Plant Room'],['carpet','Microfilm'],['carpet','Stacks'],['concrete','Records Vault'],['carpet','Stacks'],['tile','Security Desk']],
    [['concrete','Service Lift'],['wood','Archives Annex'],['concrete','Vault Antechamber'],['concrete','Vault Control'],['wood','Records Office'],['tile','Monitor Room']],
    [['concrete','Vent Shaft'],['wood','Upper Stacks'],['wood','Upper Stacks'],['concrete','Vault Roof'],['tile','Director\'s Office'],['gravel','Fire Escape']]
  ]),
  edges: snakeEdges({ 2: ['door',1.8], 9: ['door',0.9], 14: ['door',0.9], 20: ['door',0.9], 26: ['door',0.9] }).concat([
    E('A1','A2','open',4), E('B1','B2','open',4), E('C1','C2','door',0.9),
    E('D1','D2','open',4), E('E1','E2','open',4), E('F2','F3','open',4),
    E('B2','B3','glass',0.1), E('C2','C3','open',4), E('D2','D3','door',0.9),
    E('E2','E3','open',4),
    E('A3','A4','open',4), E('B3','B4','open',4), E('C3','C4','open',4),
    E('D3','D4','door',0.9), E('E3','E4','open',4),
    E('B4','B5','open',4), E('C4','C5','open',4), E('D4','D5','open',4),
    E('E4','E5','open',4), E('F4','F5','open',4)
  ]),
  lights: [
    { id:'AR-L1', cell:'L0-C2', radius:2, intensity:0.7, on:true, facing:'S' },
    { id:'AR-L2', cell:'L0-D3', radius:2, intensity:0.9, on:true },
    { id:'AR-L3', cell:'L0-F3', radius:3, intensity:0.8, on:true },
    { id:'AR-L4', cell:'L0-B3', radius:2, intensity:0.4, on:false },
    { id:'AR-L5', cell:'L0-E4', radius:3, intensity:0.6, on:true, facing:'N' }
  ],
  doors: doorsFrom([
    ['C1','D1','open'], ['C2','B2','closed'], ['C3','D3','locked'],
    ['D4','C4','locked'], ['C5','D5','closed'], ['C1','C2','closed'],
    ['D2','D3','closed'], ['D3','D4','closed']
  ])
};

// ============================================================
// 3. THE GLASSHOUSE
// ============================================================
var safehouse = {
  name: 'THE GLASSHOUSE',
  ambient: 0.08,
  cells: grid([
    [['dirt','Cliff Path'],['grass','Garden'],['tile','Entry Hall'],['wood','Living Room'],['wood','Kitchen'],['stone','Sea Terrace']],
    [['dirt','Cliff Path'],['grass','Garden'],['tile','Foyer'],['wood','Living Room'],['wood','Dining Room'],['stone','Sea Wall']],
    [['rock','Rock Face'],['grass','Courtyard'],['tile','Inner Hall'],['carpet','Study'],['wood','Comms Room'],['stone','Cliff Edge']],
    [['rock','Rock Face'],['wood','Guest Wing'],['wood','Guest Wing'],['carpet','Study Annex'],['tile','Safe Room'],['stone','Cliff Walk']],
    [['rock','Ridge'],['wood','Upper Deck'],['wood','Upper Deck'],['wood','Roof Terrace'],['tile','Observation Deck'],['water','Extraction Point']]
  ]),
  edges: snakeEdges({ 2: ['door',0.9], 14: ['door',0.9], 19: ['door',0.9], 24: ['door',0.9] }).concat([
    E('A1','A2','open',4), E('B1','B2','open',4), E('C1','C2','open',4),
    E('D1','D2','open',4), E('E1','E2','open',4), E('F1','F2','open',4),
    E('B2','B3','open',4), E('C2','C3','door',0.9), E('D2','D3','open',4),
    E('E2','E3','open',4), E('F2','F3','glass',0.1),
    E('A3','A4','open',4), E('B3','B4','open',4), E('C3','C4','open',4),
    E('D3','D4','glass',0.1), E('E3','E4','door',0.9), E('F3','F4','open',4),
    E('B4','B5','open',4), E('C4','C5','open',4), E('D4','D5','open',4),
    E('E4','E5','door',0.9), E('F4','F5','open',4)
  ]),
  lights: [
    { id:'SH-L1', cell:'L0-C2', radius:2, intensity:0.6, on:true, facing:'S' },
    { id:'SH-L2', cell:'L0-D3', radius:2, intensity:0.5, on:true },
    { id:'SH-L3', cell:'L0-F2', radius:3, intensity:0.3, on:false },
    { id:'SH-L4', cell:'L0-E4', radius:2, intensity:0.8, on:true },
    { id:'SH-L5', cell:'L0-F5', radius:2, intensity:0.2, on:false }
  ],
  doors: doorsFrom([
    ['C1','D1','closed'], ['C3','D3','locked'], ['E4','D4','locked'],
    ['A5','B5','closed'], ['C2','C3','closed'], ['E3','E4','closed'], ['E4','E5','closed']
  ])
};

var MAPS = {
  transit: transit,
  archive: archive,
  safehouse: safehouse
};

module.exports = { MAPS: MAPS };
