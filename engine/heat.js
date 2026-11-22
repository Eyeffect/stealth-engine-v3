// engine/heat.js — per-cell and global heat with hysteresis threshold events.
// A threshold fires once on an upward crossing and re-arms only once heat has
// fallen below threshold.at * 0.6 (hysteresis prevents chatter at the edge).
'use strict';

const DEFAULT_THRESHOLDS = [
  { at: 10, event: 'checkin' },
  { at: 35, event: 'sweep' },
  { at: 70, event: 'lockdown' }
];

function num(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function makeHeat(opts) {
  opts = opts || {};
  const decay = Math.max(0, num(opts.decay, 1));
  const thresholds = Array.isArray(opts.thresholds) && opts.thresholds.length
    ? opts.thresholds.map(t => ({ at: num(t.at, 0), event: String(t.event || 'threshold') }))
    : DEFAULT_THRESHOLDS.map(t => ({ at: t.at, event: t.event }));

  let globalHeat = 0;
  const cells = {};   // cell -> heat
  const fired = new Set(); // scope keys already crossed and awaiting reset
  let pending = [];   // events awaiting drain by tick()

  function key(threshold, scope, cell) {
    return scope + '|' + (cell == null ? '' : cell) + '|' + threshold.event + '|' + threshold.at;
  }

  // A scope is armed when its key is NOT in `fired`. Falling below at*0.6
  // re-arms it; an upward crossing while armed fires once.
  function check(threshold, scope, cell, level, reason) {
    const k = key(threshold, scope, cell);
    if (level < threshold.at * 0.6) {
      fired.delete(k);
      return;
    }
    if (level >= threshold.at && !fired.has(k)) {
      fired.add(k);
      const ev = { event: threshold.event, level: level, reason: reason == null ? null : reason };
      if (cell != null) ev.cell = cell;
      pending.push(ev);
    }
  }

  function evaluate(reason) {
    thresholds.forEach(t => {
      check(t, 'GLOBAL', null, globalHeat, reason);
      Object.keys(cells).forEach(c => check(t, 'CELL', c, cells[c], reason));
    });
  }

  function add(cell, amount, reason) {
    const a = num(amount, 0);
    if (cell != null && String(cell) !== '') {
      const c = String(cell);
      cells[c] = (cells[c] || 0) + a;
    }
    globalHeat += a;
    evaluate(reason);
    return globalHeat;
  }

  function tick() {
    globalHeat = Math.max(0, globalHeat - decay);
    Object.keys(cells).forEach(c => { cells[c] = Math.max(0, cells[c] - decay); });
    evaluate(null);
    const out = pending;
    pending = [];
    return out;
  }

  function level(cell) {
    if (cell == null || String(cell) === '') return globalHeat;
    return cells[String(cell)] || 0;
  }
  function global() { return globalHeat; }

  function status() {
    return {
      global: globalHeat,
      cells: Object.assign({}, cells),
      fired: Array.from(fired)
    };
  }

  function dump() {
    return {
      decay: decay,
      thresholds: thresholds.map(t => ({ at: t.at, event: t.event })),
      global: globalHeat,
      cells: Object.assign({}, cells),
      fired: Array.from(fired),
      pending: pending.slice()
    };
  }

  function load(obj) {
    obj = obj || {};
    globalHeat = num(obj.global, 0);
    const nextCells = {};
    Object.keys(obj.cells || {}).forEach(c => { nextCells[c] = num(obj.cells[c], 0); });
    Object.keys(cells).forEach(c => { delete cells[c]; });
    Object.keys(nextCells).forEach(c => { cells[c] = nextCells[c]; });
    fired.clear();
    (Array.isArray(obj.fired) ? obj.fired : []).forEach(k => fired.add(String(k)));
    pending = Array.isArray(obj.pending) ? obj.pending.slice() : [];
    return heat;
  }

  const heat = {
    add: add,
    tick: tick,
    level: level,
    global: global,
    status: status,
    dump: dump,
    load: load,
    thresholds: thresholds
  };
  return heat;
}

module.exports = { makeHeat: makeHeat };
