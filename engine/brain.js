// engine/brain.js — NPC decision brain.
// Five role policies with genuinely different behaviour. Every stochastic
// decision is funnelled through rng.d100(label,target); no direct Math.random.
'use strict';

// ---- trait defaults (per-NPC overrides are merged on top) ----------------
const ROLE_DEFAULTS = {
  guard:      { alertness: 60, curiosity: 55, nerve: 60, discipline: 70 },
  bodyguard:  { alertness: 80, curiosity: 15, nerve: 75, discipline: 90 },
  courier:    { alertness: 45, curiosity: 20, nerve: 40, discipline: 40 },
  target:     { alertness: 35, curiosity: 10, nerve: 30, discipline: 30 },
  technician: { alertness: 50, curiosity: 25, nerve: 55, discipline: 80 }
};

function traitsFor(npc) {
  const base = ROLE_DEFAULTS[npc.role] || ROLE_DEFAULTS.guard;
  const out = { alertness: base.alertness, curiosity: base.curiosity,
                nerve: base.nerve, discipline: base.discipline };
  const ov = npc.traits || {};
  Object.keys(out).forEach(k => {
    if (typeof ov[k] === 'number' && isFinite(ov[k])) out[k] = ov[k];
  });
  return out;
}

// ---- small pure helpers ---------------------------------------------------
function dec(mode, target, facing, reason, priority, delay, radio) {
  return {
    mode: mode,
    target: target || null,
    facing: facing || 'N',
    radio: radio || null,
    priority: typeof priority === 'number' ? priority : 0,
    delay: typeof delay === 'number' ? delay : 0,
    reason: reason || ''
  };
}

function cur(npc, ctx) {
  const p = ctx.positions[npc.id];
  return (p && p.cell) || npc.cell;
}

function full(map, cell) {
  if (cell == null) return cell;
  if (map && typeof map.normalize === 'function') {
    try { return map.normalize(cell); } catch (e) { /* fall through */ }
  }
  return cell;
}

function cellLabel(map, cell) {
  if (!cell) return '—';
  let name = '';
  if (map && typeof map.roomName === 'function') {
    try { name = map.roomName(cell); } catch (e) { name = ''; }
  }
  return (name && String(name).trim()) ? String(name).trim() : String(cell);
}

function latestCell(list) {
  if (!Array.isArray(list)) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e == null) continue;
    if (typeof e === 'string') return e;
    if (typeof e === 'object') {
      if (e.cell) return e.cell;
      if (e.at) return e.at;
      if (e.location) return e.location;
    }
  }
  return null;
}

function isGunshot(b) {
  if (b.gunshotHeard) return true;
  const heard = Array.isArray(b.heard) ? b.heard : [];
  return heard.some(h => {
    if (!h) return false;
    if (typeof h === 'string') return /gunshot|gunshot/i.test(h);
    if (typeof h === 'object') {
      return h.gunshot === true || h.type === 'gunshot' || h.kind === 'gunshot' ||
             h.weapon === 'gunshot' || /gunshot|gunshot/i.test(String(h.text || ''));
    }
    return false;
  });
}

function threatCellFrom(b) {
  const s = b.seesPlayer;
  if (!s) return null;
  if (typeof s === 'string') return s;
  if (typeof s === 'object') return s.cell || s.at || s.location || null;
  return null;
}

function threatInfo(b) {
  const evidence = Array.isArray(b.evidence) ? b.evidence : [];
  const heard = Array.isArray(b.heard) ? b.heard : [];
  const gun = isGunshot(b);
  const visual = !!b.seesPlayer;
  const cell = threatCellFrom(b) || latestCell(evidence) || latestCell(heard) || null;
  return {
    threat: visual || evidence.length > 0 || gun,
    cell: cell,
    evidence: evidence,
    heard: heard,
    gun: gun,
    visual: visual
  };
}

function facingToward(map, from, to, fallback) {
  if (!to) return fallback || 'N';
  if (!map || typeof map.xy !== 'function') return fallback || 'N';
  try {
    const a = map.xy(from), b = map.xy(to);
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx === 0 && dy === 0) return fallback || 'N';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
    return dy > 0 ? 'N' : 'S'; // map y increases north (see SPEC)
  } catch (e) {
    return fallback || 'N';
  }
}

function mapDist(ctx, a, b) {
  try { return (ctx.map && typeof ctx.map.dist === 'function') ? ctx.map.dist(a, b) : 0; }
  catch (e) { return 0; }
}

function mapLosClear(ctx, a, b) {
  try {
    const r = ctx.map && typeof ctx.map.los === 'function' ? ctx.map.los(a, b) : null;
    return !!(r && r.clear);
  } catch (e) { return false; }
}

function heatGlobal(ctx) {
  try {
    if (ctx.heat && typeof ctx.heat.global === 'function') return Number(ctx.heat.global()) || 0;
  } catch (e) { /* no heat */ }
  return 0;
}

function roll(ctx, label, target) {
  // Single funnel for every roll. rng.d100 returns {roll,target,...}.
  const r = ctx.rng.d100(label, target);
  return r || { roll: target + 1, target: target }; // absent roll ⇒ treat as failure
}

function hesitation(ctx, npc, label, t) {
  const r = roll(ctx, label, t.nerve);
  return (r.roll > r.target) ? 3 : 0; // nerve failure ⇒ 3s hesitation
}

function safeCell(world, map) {
  let c = world.objectiveCell || world.exitCell;
  if (!c && world.exit && world.exit.cell) c = world.exit.cell;
  if (!c && Array.isArray(world.objectives)) {
    const ex = world.objectives.find(o => o && o.type === 'extract' && o.target);
    if (ex) c = ex.target;
  }
  if (!c && map && map.cells) {
    const keys = Object.keys(map.cells);
    c = keys.length ? keys[keys.length - 1] : 'L0-A1';
  }
  if (!c) c = 'L0-A1';
  return full(map, c);
}

function findPrincipal(npcs) {
  let p = npcs.find(n => n.role === 'target' && n.alive !== false);
  if (!p) p = npcs.find(n => n.role === 'target');
  return p || null;
}

function toldAlarm(b) {
  const told = Array.isArray(b.told) ? b.told : [];
  return told.some(t => {
    if (!t) return false;
    const s = (typeof t === 'object') ? String(t.text || t.event || t.kind || '') : String(t);
    return /alarm|lockdown|intruder|contact|gunshot|breach/i.test(s);
  });
}

function orientToNoise(ctx, npc, b, t, cell, fallback) {
  const heard = Array.isArray(b.heard) ? b.heard : [];
  if (!heard.length) return fallback;
  const r = roll(ctx, npc.id + ':orient:alertness', t.alertness);
  if (r.roll <= r.target) {
    return facingToward(ctx.map, cell, latestCell(heard) || cell, fallback);
  }
  return fallback;
}

// ---- role policies --------------------------------------------------------

function decideGuard(npc, b, ctx) {
  const cell = cur(npc, ctx), t = traitsFor(npc), ti = threatInfo(b);
  const told = Array.isArray(b.told) ? b.told : [];
  const H = heatGlobal(ctx);

  // 1. Visual / evidence / gunshot → hard alert + radio (gunshot skips curiosity).
  if (ti.threat) {
    const tgt = ti.cell || cell;
    const delay = hesitation(ctx, npc, npc.id + ':alert:nerve', t);
    return dec('alert', tgt, facingToward(ctx.map, cell, tgt, npc.facing),
      ti.gun ? 'gunshot heard — hard alert' :
      (ti.visual ? 'intruder sighted — engaging' : 'evidence found — raising alert'),
      3, delay, 'CONTACT: intruder at ' + cellLabel(ctx.map, tgt));
  }

  // 2. Radio report from a colleague → investigate the reported cell.
  if (told.length) {
    const tgt = latestCell(told) || cell;
    const delay = hesitation(ctx, npc, npc.id + ':report:nerve', t);
    return dec('search', tgt, facingToward(ctx.map, cell, tgt, npc.facing),
      'radio report received', 2, delay, 'copy — checking ' + cellLabel(ctx.map, tgt));
  }

  // 3. Accumulated suspicion or elevated heat → systematic sweep.
  const susp = Number(b.suspicion) || 0;
  if (susp >= 2 || H >= 35) {
    const tgt = latestCell(ti.evidence) || latestCell(ti.heard) || cell;
    const delay = hesitation(ctx, npc, npc.id + ':sweep:nerve', t);
    return dec('sweep', tgt, facingToward(ctx.map, cell, tgt, npc.facing),
      H >= 35 ? 'heat high — sweeping sector' : 'suspicion high — sweeping sector',
      2, delay, 'sweeping ' + cellLabel(ctx.map, tgt));
  }

  // 4. Non-gunshot sound → curiosity roll decides whether to investigate.
  if (ti.heard.length) {
    const cRoll = roll(ctx, npc.id + ':noise:curiosity', t.curiosity);
    if (cRoll.roll <= cRoll.target) {
      const tgt = latestCell(ti.heard) || cell;
      const clear = mapLosClear(ctx, cell, tgt);
      const delay = hesitation(ctx, npc, npc.id + ':noise:nerve', t);
      return dec('search', tgt, facingToward(ctx.map, cell, tgt, npc.facing),
        'investigating noise' + (clear ? '' : ' (obstructed)'),
        1, delay, 'checking noise at ' + cellLabel(ctx.map, tgt));
    }
    // curiosity failed — ignore and continue patrol
  }

  // 5. Routine patrol route.
  const patrol = Array.isArray(npc.patrol) && npc.patrol.length ? npc.patrol : null;
  let next = null;
  if (patrol) {
    const fc = full(ctx.map, cell);
    const idx = patrol.findIndex(c => full(ctx.map, c) === fc);
    next = idx >= 0 ? patrol[(idx + 1) % patrol.length] : patrol[0];
    if (full(ctx.map, next) === fc && patrol.length > 1) next = patrol[1];
  }
  return dec('patrol', next, facingToward(ctx.map, cell, next, npc.facing),
    'routine patrol', 0, 0, null);
}

function decideBodyguard(npc, b, ctx) {
  const cell = cur(npc, ctx), t = traitsFor(npc), ti = threatInfo(b);
  const principal = ctx.principal;
  const pcell = principal
    ? ((ctx.positions[principal.id] && ctx.positions[principal.id].cell) || principal.cell)
    : ctx.safe;
  const dist = mapDist(ctx, cell, pcell);

  // Threat → shield the principal. NEVER leave them to chase a noise.
  if (ti.threat) {
    const delay = hesitation(ctx, npc, npc.id + ':shield:nerve', t);
    const face = ti.cell ? facingToward(ctx.map, cell, ti.cell, npc.facing)
                         : facingToward(ctx.map, cell, pcell, npc.facing);
    return dec('shield', pcell, face, 'close protection — covering principal',
      3, delay, 'close protection');
  }

  // Out of formation → close the gap (this is still guarding, not investigating).
  if (dist > 1) {
    return dec('shield', pcell, facingToward(ctx.map, cell, pcell, npc.facing),
      'closing on principal', 2, 0, null);
  }

  // In formation → hold close cover; alertness may orient gaze to a noise.
  const face = orientToNoise(ctx, npc, b, t, cell, npc.facing);
  return dec('cover', pcell, face, 'close protection — holding position', 1, 0, null);
}

function decideCourier(npc, b, ctx) {
  const cell = cur(npc, ctx), t = traitsFor(npc), ti = threatInfo(b);

  if (ti.threat) {
    const nr = roll(ctx, npc.id + ':flee:nerve', t.nerve);
    const composed = nr.roll <= nr.target;
    if (composed) {
      return dec('flee', ctx.safe, facingToward(ctx.map, cell, ctx.safe, npc.facing),
        'threat near package — evacuating', 3, 0, 'package compromised — bugging out');
    }
    return dec('freeze', cell, npc.facing, 'nerve failed — froze over package',
      3, 3, null);
  }

  // Hold the package. Orient to noise if alert, but never engage or investigate.
  const face = orientToNoise(ctx, npc, b, t, cell, npc.facing);
  return dec('hold', cell, face, 'holding package', 0, 0, null);
}

function decideTarget(npc, b, ctx) {
  const cell = cur(npc, ctx), t = traitsFor(npc), ti = threatInfo(b);

  if (ti.threat) {
    const nr = roll(ctx, npc.id + ':panic:nerve', t.nerve);
    const composed = nr.roll <= nr.target;
    if (composed) {
      return dec('panic', ctx.safe, facingToward(ctx.map, cell, ctx.safe, npc.facing),
        'threat — aborting to safe room', 3, 0, 'abort');
    }
    return dec('freeze', cell, npc.facing, 'nerve failed — froze', 3, 3, null);
  }

  // Compose at post; a noise may draw a glance, never an investigation.
  const face = orientToNoise(ctx, npc, b, t, cell, npc.facing);
  return dec('compose', cell, face, 'composed at post', 0, 0, null);
}

function decideTechnician(npc, b, ctx) {
  const cell = cur(npc, ctx), t = traitsFor(npc), ti = threatInfo(b);
  const H = heatGlobal(ctx);
  const alarm = ti.gun || ti.threat || toldAlarm(b) || H >= 70;

  if (alarm) {
    const delay = hesitation(ctx, npc, npc.id + ':lockdown:nerve', t);
    return dec('lockdown', cell, npc.facing, 'alarm — locking down station',
      3, delay, 'lockdown');
  }

  // Technician never leaves the workstation; alertness only turns the head.
  const face = orientToNoise(ctx, npc, b, t, cell, npc.facing);
  return dec('station', cell, face, 'manning workstation', 0, 0, null);
}

// ---- trace ----------------------------------------------------------------
function makeTrace(npc, cell, d, map) {
  const here = cellLabel(map, cell);
  const tgt = d.target ? cellLabel(map, d.target) : '—';
  return npc.id + ' (' + (npc.role || 'npc') + ') @ ' + here + ': ' + d.mode + ' → ' + tgt;
}

// ---- public API -----------------------------------------------------------
function decideAll(world, beliefs, positions, map, rng, heat) {
  world = world || {};
  beliefs = beliefs || {};
  positions = positions || {};
  rng = rng || { d100: function (l, t) { return { roll: t + 1, target: t }; } };

  const npcs = Array.isArray(world.npcs) ? world.npcs : [];
  const ctx = {
    world: world, beliefs: beliefs, positions: positions, map: map, rng: rng,
    heat: heat, npcs: npcs,
    principal: findPrincipal(npcs),
    safe: safeCell(world, map)
  };

  const decisions = {};
  const trace = [];

  npcs.forEach(npc => {
    const b = beliefs[npc.id] || {};
    const p = positions[npc.id];
    const cell = cur(npc, ctx);
    let d;
    if (npc.alive === false || (p && p.mode === 'down')) {
      d = dec('down', null, npc.facing, 'KIA / down', -1, 0, null);
    } else {
      switch (npc.role) {
        case 'bodyguard': d = decideBodyguard(npc, b, ctx); break;
        case 'courier':   d = decideCourier(npc, b, ctx); break;
        case 'target':    d = decideTarget(npc, b, ctx); break;
        case 'technician':d = decideTechnician(npc, b, ctx); break;
        case 'guard':
        default:          d = decideGuard(npc, b, ctx); break;
      }
    }
    decisions[npc.id] = d;
    trace.push(makeTrace(npc, cell, d, map));
  });

  return { decisions: decisions, trace: trace };
}

module.exports = { decideAll: decideAll };
