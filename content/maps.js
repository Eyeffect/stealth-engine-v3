// content/maps.js — three 6x5 stealth maps for THE QUIET LEDGER.
// Cell ids are short (A1..F5); edges/doors/lights use full ids (L0-A1).
//
// FLOORPLAN MODEL
// ---------------
// A SOLID WALL is the ABSENCE of an edge declaration between two orthogonally
// adjacent cells. Only real passages are declared:
//   'open'  — inside a room / along a corridor (width 4)
//   'door'  — a doorway between rooms (width 0.9 / 1.8 / 3.0)
//   'glass' — an interior window: sight passes, movement does not (width 0.1)
// Every other adjacent pair is left undeclared and is therefore a wall.
//
// Each grid has 49 adjacent pairs. Each map declares 29 edges (27 passable +
// 2 glass), leaving 20 walls = 40.8% of pairs. Rooms are bounded by those
// walls; a few sealed service cells (vent shafts / roof access) are
// intentionally isolated, like real buildings.
'use strict';

// Edge shorthand: E('A1','B1','door',0.9) -> ['L0-A1','L0-B1','door',0.9]
function E(a, b, type, width) {
  return ['L0-' + a, 'L0-' + b, type, width];
}
// Door-key shorthand: sorted full ids joined by '|'.
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

// ============================================================
// 1. MERIDIAN TRANSIT HUB
// ============================================================
// Rooms: Service Tunnel (A1-A2), Loading Bay (B1), Baggage Claim (C1),
// Main Concourse (C1-D1-E1-D2), Parcel Office (C2-C3-D3 approach),
// Service Bay (C4-D4), Cable Run (C5-D5), plus single-cell rooms.
// Intel: C1-D1 open archway; C3-D3 locked parcel door; B3 glass partition.
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
  edges: [
    // --- internal open space ---
    E('A1','A2','open',4),                    // Service Tunnel
    E('D1','E1','open',4), E('D1','D2','open',4), E('C1','D1','open',4), // Main Concourse + archway
    E('C4','D4','open',4),                    // Service Bay
    E('C5','D5','open',4),                    // Cable Run
    // --- doorways between rooms ---
    E('A2','B2','door',1.8), E('B2','C2','door',0.9), E('C2','D2','door',1.8),
    E('C1','B1','door',0.9),
    E('B2','B3','door',0.9), E('A2','A3','door',0.9), E('A3','A4','door',0.9),
    E('B3','B4','door',0.9), E('B4','C4','door',0.9),
    E('C2','C3','door',0.9), E('C3','D3','door',1.8), // locked parcel office
    E('C4','C5','door',0.9), E('D5','E5','door',0.9), E('E5','F5','door',0.9),
    E('E1','E2','door',0.9), E('E2','F2','door',0.9), E('F2','F3','door',0.9),
    E('F3','F4','door',0.9), E('E4','F4','door',0.9), E('E2','E3','door',0.9),
    E('E1','F1','door',0.9),
    // --- windows ---
    E('B3','C3','glass',0.1),                 // unwatched partition at B3
    E('E3','F3','glass',0.1)                  // info desk onto Platform 3
  ],
  lights: [
    { id:'T-L1', cell:'L0-C2', radius:3, intensity:1.0, on:true, facing:'S' },
    { id:'T-L2', cell:'L0-D3', radius:2, intensity:0.8, on:true },
    { id:'T-L3', cell:'L0-B4', radius:3, intensity:0.6, on:true, facing:'N' },
    { id:'T-L4', cell:'L0-F2', radius:2, intensity:0.5, on:false },
    { id:'T-L5', cell:'L0-E4', radius:3, intensity:1.1, on:true }
  ],
  doors: doorsFrom([
    ['A2','B2','open'],   ['B2','C2','closed'], ['C2','D2','open'],
    ['C1','B1','closed'], ['B2','B3','closed'], ['A2','A3','closed'],
    ['A3','A4','closed'], ['B3','B4','closed'], ['B4','C4','closed'],
    ['C2','C3','closed'], ['C3','D3','locked'], ['C4','C5','closed'],
    ['D5','E5','closed'], ['E5','F5','open'],   ['E1','E2','open'],
    ['E2','F2','open'],   ['F2','F3','open'],   ['F3','F4','open'],
    ['E4','F4','open'],   ['E2','E3','closed'], ['E1','F1','open']
  ])
};

// ============================================================
// 2. HALCYON ARCHIVE
// ============================================================
// Rooms: Loading Dock (A1-A2), Sorting Room (B1-B2), Front Lobby (C1-D1),
// Reading Room (D2-E2), Upper Stacks (B5-C5), Records Vault (D3) behind
// two locked doors (C3-D3 and D3-D4) per intel.
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
  edges: [
    // --- internal open space ---
    E('A1','A2','open',4),                    // Loading Dock / Ramp
    E('B1','B2','open',4),                    // Sorting Room
    E('C1','D1','open',4),                    // Front Lobby
    E('D2','E2','open',4),                    // Reading Room
    E('F1','F2','open',4),                    // Staff Entrance / Corridor
    E('B5','C5','open',4),                    // Upper Stacks
    // --- doorways between rooms ---
    E('A2','B2','door',0.9), E('B1','C1','door',0.9), E('D1','D2','door',0.9),
    E('E2','E1','door',0.9), E('E1','F1','door',0.9), E('F2','F3','door',0.9),
    E('B2','C2','door',0.9), E('C2','C3','door',0.9),
    E('C3','D3','door',0.9), E('D3','D4','door',0.9), // locked vault doors
    E('D4','C4','door',0.9), E('C4','B4','door',0.9), E('B4','A4','door',0.9),
    E('A4','A3','door',0.9), E('A3','B3','door',0.9), E('B4','B5','door',0.9),
    E('C5','D5','door',0.9), E('D5','E5','door',0.9), E('E5','E4','door',0.9),
    E('E4','F4','door',0.9), E('E2','E3','door',0.9),
    // --- windows ---
    E('B3','C3','glass',0.1),                 // Microfilm / Stacks partition
    E('E3','D3','glass',0.1)                  // Stacks onto the Records Vault
  ],
  lights: [
    { id:'AR-L1', cell:'L0-C2', radius:2, intensity:0.7, on:true, facing:'S' },
    { id:'AR-L2', cell:'L0-D3', radius:2, intensity:0.9, on:true },
    { id:'AR-L3', cell:'L0-F3', radius:3, intensity:0.8, on:true },
    { id:'AR-L4', cell:'L0-B3', radius:2, intensity:0.4, on:false },
    { id:'AR-L5', cell:'L0-E4', radius:3, intensity:0.6, on:true, facing:'N' }
  ],
  doors: doorsFrom([
    ['A2','B2','closed'], ['B1','C1','closed'], ['D1','D2','open'],
    ['E2','E1','closed'], ['E1','F1','open'],   ['F2','F3','open'],
    ['B2','C2','closed'], ['C2','C3','closed'], ['C3','D3','locked'],
    ['D3','D4','locked'], ['D4','C4','locked'], ['C4','B4','closed'],
    ['B4','A4','closed'], ['A4','A3','closed'], ['A3','B3','closed'],
    ['B4','B5','closed'], ['C5','D5','closed'], ['D5','E5','closed'],
    ['E5','E4','closed'], ['E4','F4','open'],   ['E2','E3','closed']
  ])
};

// ============================================================
// 3. THE GLASSHOUSE
// ============================================================
// Rooms: Cliff Path (A1-A2), Garden (B1-B2), Living Room (D1-D2),
// Guest Wing (B4-C4), Rock Face (A3-A4), Safe Room (E4) with a locked
// approach, Observation Deck (E5) and the exposed Cliff Walk (F4-F5).
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
  edges: [
    // --- internal open space ---
    E('A1','A2','open',4),                    // Cliff Path
    E('B2','B1','open',4),                    // Garden
    E('D2','D1','open',4),                    // Living Room
    E('C4','B4','open',4),                    // Guest Wing
    E('A4','A3','open',4),                    // Rock Face
    // --- doorways between rooms ---
    E('A2','B2','door',0.9), E('B1','C1','door',0.9), E('C1','C2','door',0.9),
    E('C2','C3','door',0.9), E('C3','D3','door',0.9), E('D3','D2','door',0.9),
    E('D1','E1','door',0.9), E('E1','E2','door',0.9), E('E2','F2','door',0.9),
    E('F2','F1','door',0.9), E('C3','C4','door',0.9), E('B3','C3','door',0.9),
    E('B4','A4','door',0.9), E('C4','D4','door',0.9),
    E('D4','E4','door',0.9), E('E4','E3','door',0.9), E('E3','F3','door',0.9),
    E('E4','F4','door',0.9), E('F4','F5','door',0.9), E('E4','E5','door',0.9),
    E('D5','E5','door',0.9), E('C5','D5','door',0.9),
    // --- windows ---
    E('E3','D3','glass',0.1),                 // Comms Room onto the Study
    E('F2','F3','glass',0.1)                  // Sea Wall window onto Cliff Edge
  ],
  lights: [
    { id:'SH-L1', cell:'L0-C2', radius:2, intensity:0.6, on:true, facing:'S' },
    { id:'SH-L2', cell:'L0-D3', radius:2, intensity:0.5, on:true },
    { id:'SH-L3', cell:'L0-F2', radius:3, intensity:0.3, on:false },
    { id:'SH-L4', cell:'L0-E4', radius:2, intensity:0.8, on:true },
    { id:'SH-L5', cell:'L0-F5', radius:2, intensity:0.2, on:false }
  ],
  doors: doorsFrom([
    ['A2','B2','closed'], ['B1','C1','closed'], ['C1','C2','open'],
    ['C2','C3','closed'], ['C3','D3','open'],   ['D3','D2','closed'],
    ['D1','E1','open'],   ['E1','E2','open'],   ['E2','F2','closed'],
    ['F2','F1','open'],   ['C3','C4','closed'], ['B3','C3','closed'],
    ['B4','A4','closed'], ['C4','D4','closed'], ['D4','E4','locked'],
    ['E4','E3','locked'], ['E3','F3','open'],   ['E4','F4','open'],
    ['F4','F5','open'],   ['E4','E5','locked'], ['D5','E5','open'],
    ['C5','D5','closed']
  ])
};

var MAPS = {
  transit: transit,
  archive: archive,
  safehouse: safehouse
};

module.exports = { MAPS: MAPS };
