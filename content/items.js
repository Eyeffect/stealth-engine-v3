// content/items.js — gear catalog for THE QUIET LEDGER.
// Each entry: {id,name,cost,category,specs:[3 strings],timeCost (s),noise (dB),weight (kg)}.
'use strict';

const ITEMS = {
  // ---- firearms ----
  pistol: {
    id: 'pistol', name: 'Suppressed 9mm Pistol', cost: 4200, category: 'firearms',
    specs: ['9mm subsonic', '15+1 rounds', 'threaded / suppressed'],
    timeCost: 1.2, noise: 74, weight: 0.9
  },
  revolver: {
    id: 'revolver', name: 'Caseless Revolver', cost: 1800, category: 'firearms',
    specs: ['.22 LR', '6-round cylinder', 'retains casings'],
    timeCost: 1.0, noise: 92, weight: 0.7
  },
  smg: {
    id: 'smg', name: 'Compact SMG', cost: 5600, category: 'firearms',
    specs: ['9mm', '30-round magazine', 'select fire'],
    timeCost: 1.5, noise: 98, weight: 2.6
  },
  rifle: {
    id: 'rifle', name: 'Bolt-Action Rifle', cost: 7800, category: 'firearms',
    specs: ['5.56mm', '20-round magazine', 'long range precision'],
    timeCost: 2.0, noise: 106, weight: 3.4
  },

  // ---- melee ----
  knife: {
    id: 'knife', name: 'Fixed-Blade Knife', cost: 120, category: 'melee',
    specs: ['12 cm blade', 'full tang', 'near-silent'],
    timeCost: 0.8, noise: 24, weight: 0.2
  },
  garrote: {
    id: 'garrote', name: 'Cable Garrote', cost: 60, category: 'melee',
    specs: ['1.2 m braided cable', 'wooden grips', 'concealable'],
    timeCost: 2.5, noise: 14, weight: 0.05
  },
  baton: {
    id: 'baton', name: 'Telescopic Baton', cost: 180, category: 'melee',
    specs: ['61 cm extended', 'steel shaft', 'impact weapon'],
    timeCost: 0.9, noise: 46, weight: 0.5
  },

  // ---- tools ----
  lockpick: {
    id: 'lockpick', name: 'Lockpick Set', cost: 240, category: 'tools',
    specs: ['tension wrench + picks', 'medium security', 'reusable'],
    timeCost: 6, noise: 18, weight: 0.1
  },
  bypass: {
    id: 'bypass', name: 'Electronic Bypass', cost: 900, category: 'tools',
    specs: ['defeats standard locks', '3 charges', 'reusable device'],
    timeCost: 3, noise: 30, weight: 0.25
  },
  cutters: {
    id: 'cutters', name: 'Bolt Cutters', cost: 160, category: 'tools',
    specs: ['12 mm bar capacity', 'manual leverage', 'heavy'],
    timeCost: 8, noise: 64, weight: 1.8
  },
  climb_rig: {
    id: 'climb_rig', name: 'Climb Rig', cost: 650, category: 'tools',
    specs: ['15 m rope + harness', 'anchored descent', 'load rated'],
    timeCost: 12, noise: 20, weight: 2.2
  },
  door_wedge: {
    id: 'door_wedge', name: 'Door Wedge', cost: 45, category: 'tools',
    specs: ['rubber wedge', 'holds one door ajar', 'silent'],
    timeCost: 0.6, noise: 8, weight: 0.08
  },
  crowbar: {
    id: 'crowbar', name: 'Pry Bar', cost: 70, category: 'tools',
    specs: ['60 cm forged bar', 'forced entry', 'loud'],
    timeCost: 3, noise: 78, weight: 1.2
  },

  // ---- electronics ----
  jammer: {
    id: 'jammer', name: 'RF Jammer', cost: 1400, category: 'electronics',
    specs: ['20 m radius', '45 s charge', 'cuts local comms'],
    timeCost: 1, noise: 12, weight: 0.4
  },
  decoder: {
    id: 'decoder', name: 'Signal Decoder', cost: 1100, category: 'electronics',
    specs: ['cracks encrypted comms', 'instant readout', 'rechargeable'],
    timeCost: 2, noise: 10, weight: 0.3
  },
  fibercam: {
    id: 'fibercam', name: 'Fiber-Optic Camera', cost: 780, category: 'electronics',
    specs: ['3 m flexible probe', 'visual feed', 'silent'],
    timeCost: 3, noise: 5, weight: 0.35
  },
  radio: {
    id: 'radio', name: 'Encrypted Radio', cost: 680, category: 'electronics',
    specs: ['secure channel', 'long range', 'rechargeable'],
    timeCost: 1, noise: 35, weight: 0.5
  },

  // ---- consumables ----
  decoy: {
    id: 'decoy', name: 'Throwable Decoy', cost: 220, category: 'consumables',
    specs: ['8 m noise radius', 'single use', 'disposable'],
    timeCost: 0.5, noise: 86, weight: 0.12
  },
  gas: {
    id: 'gas', name: 'Tranquilizer Gas', cost: 480, category: 'consumables',
    specs: ['4 m cloud', 'incapacitates', 'single use'],
    timeCost: 2, noise: 30, weight: 0.3
  },
  gasmask: {
    id: 'gasmask', name: 'Respirator Mask', cost: 360, category: 'support',
    specs: ['blocks gas + smoke', '60 s filter', '+15% detection in light'],
    timeCost: 2.5, noise: 0, weight: 0.8
  },
  flashbang: {
    id: 'flashbang', name: 'Flashbang', cost: 350, category: 'consumables',
    specs: ['6 m radius', 'blinds + deafens', 'single use'],
    timeCost: 0.4, noise: 122, weight: 0.25
  },
  thermite: {
    id: 'thermite', name: 'Thermite Charge', cost: 620, category: 'consumables',
    specs: ['cuts steel', 'single use', 'intense heat'],
    timeCost: 5, noise: 88, weight: 0.6
  },
  smoke: {
    id: 'smoke', name: 'Smoke Grenade', cost: 190, category: 'consumables',
    specs: ['6 m smoke screen', 'blocks sight', 'single use'],
    timeCost: 0.5, noise: 60, weight: 0.3
  },
  medkit: {
    id: 'medkit', name: 'Trauma Medkit', cost: 300, category: 'consumables',
    specs: ['stabilizes wounds', 'single use', 'compact'],
    timeCost: 4, noise: 12, weight: 0.5
  },

  // ---- support ----
  bodybag: {
    id: 'bodybag', name: 'Body Disposal Bag', cost: 90, category: 'support',
    specs: ['fits one adult', 'folds flat', 'sealed'],
    timeCost: 8, noise: 15, weight: 0.7
  },
  ghillie: {
    id: 'ghillie', name: 'Ghillie Suit', cost: 540, category: 'support',
    specs: ['outdoor camouflage', 'bulky', 'breaks silhouette'],
    timeCost: 15, noise: 5, weight: 1.6
  },
  gloves: {
    id: 'gloves', name: 'Friction Gloves', cost: 60, category: 'support',
    specs: ['no fingerprints', 'improved grip', 'disposable'],
    timeCost: 0.5, noise: 0, weight: 0.05
  },
  booties: {
    id: 'booties', name: 'Quiet Overshoes', cost: 45, category: 'support',
    specs: ['soft soles', 'muffles steps', 'disposable'],
    timeCost: 0.5, noise: 0, weight: 0.03
  },
  tracekit: {
    id: 'tracekit', name: 'Forensic Trace Kit', cost: 950, category: 'support',
    specs: ['collects trace evidence', 'reusable case', 'sealed vials'],
    timeCost: 6, noise: 8, weight: 0.8
  },
  zip_ties: {
    id: 'zip_ties', name: 'Zip Ties', cost: 35, category: 'support',
    specs: ['5 heavy-duty ties', 'restrains captive', 'lightweight'],
    timeCost: 1, noise: 6, weight: 0.1
  }
};

module.exports = { ITEMS: ITEMS };
