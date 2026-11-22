// engine/physics.js — material acoustics, light, sound propagation and localization.
'use strict';

const rng = require('./rng');

const MATERIAL = {
  marble: 8, tile: 5, concrete: 3, gravel: 2, wood: 0, asphalt: 0,
  stone: 1, grass: -4, dirt: -3, rock: 1, hedge: -6, glass: 2,
  water: -2, carpet: -5
};

const FULL_RE = /^L[01]-[A-F][1-5]$/;
const SHORT_RE = /^[A-F][1-5]$/;
const DIRVEC = { N: { x: 0, y: 1 }, S: { x: 0, y: -1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };

// Resolve short ids against the map's cells; fall back to the default level.
function fullId(map, id) {
  if (id == null) return id;
  const s = String(id).trim().toUpperCase();
  if (FULL_RE.test(s)) return s;
  if (!SHORT_RE.test(s)) return id;
  const cellMap = map && map.cells;
  if (cellMap) {
    const hits = Object.keys(cellMap).filter(k => k.endsWith('-' + s));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      const preferred = 'L0-' + s;
      return cellMap[preferred] ? preferred : hits[0];
    }
  }
  return 'L0-' + s;
}

function pos(map, id) {
  const m = String(fullId(map, id) == null ? '' : fullId(map, id)).match(/^(L[01])-([A-F])([1-5])$/);
  if (!m) return { level: 'L0', x: 0, y: 0 };
  return { level: m[1], x: m[2].charCodeAt(0) - 65, y: Number(m[3]) - 1 };
}

// Linear attenuation to zero at radius. d = 0 -> 1, d >= radius -> 0.
function falloff(dist, radius) {
  const d = Math.max(0, Number(dist) || 0);
  const r = Number(radius) || 0;
  if (r <= 0) return d === 0 ? 1 : 0;
  if (d >= r) return 0;
  return 1 - d / r;
}

function lightAt(map, cell, lights, env) {
  env = env || {};
  const C = fullId(map, cell);
  const cp = pos(map, C);
  let L;
  if (typeof env.ambientLight === 'number') L = env.ambientLight;
  else if (map && map.def && typeof map.def.ambient === 'number') L = map.def.ambient;
  else L = 0;

  const list = Array.isArray(lights) ? lights : [];
  list.forEach(light => {
    if (!light || light.on === false) return;
    const radius = Number(light.radius) || 0;
    if (radius <= 0) return;
    const lp = pos(map, light.cell);
    const dx = cp.x - lp.x, dy = cp.y - lp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) return;
    // Light obeys geometry: solid walls block it, doorways dim it, glass passes it.
    let blocked = false, throughDoor = false;
    if (map && typeof map.los === 'function' && C !== light.cell) {
      const tr = map.los(light.cell, C, { openDoors: env.openDoors || null });
      if (tr.walls > 0) blocked = true;
      if (tr.doors > 0) throughDoor = true;
    }
    if (blocked) return;
    let add = (Number(light.intensity) || 0) * falloff(distance, radius);
    if (throughDoor) add *= 0.25;
    if (light.facing != null) {
      const key = String(light.facing).trim().toUpperCase();
      const fvec = DIRVEC[key] || light.facing;
      if (fvec && typeof fvec.x === 'number' && typeof fvec.y === 'number') {
        const flen = Math.sqrt(fvec.x * fvec.x + fvec.y * fvec.y) || 1;
        const dlen = distance || 1;
        const dot = (dx * fvec.x + dy * fvec.y) / (dlen * flen);
        if (dot < 0.2) add *= 0.25;
      }
    }
    L += add;
  });

  if (env.breaker === 'off' && cp.level === 'L1') L = Math.min(L, 0.8);
  return Math.max(0, L);
}

function audible(map, listener, snd, env, openDoors) {
  env = env || {};
  snd = snd || {};
  const S = fullId(map, snd.cell);
  const L = fullId(map, listener);
  const mat = map && typeof map.material === 'function' ? map.material(S) : 'tile';
  const bump = Object.prototype.hasOwnProperty.call(MATERIAL, mat) ? MATERIAL[mat] : 0;
  const sourceDb = (Number(snd.db) || 0) + bump;

  let occlusion = 0;
  if (map && typeof map.los === 'function') {
    const los = map.los(S, L, { openDoors: openDoors });
    occlusion = (los.walls || 0) * 8 + (los.doors || 0) * 10 + (los.glass || 0) * 2;
  }

  let dcells;
  if (map && typeof map.dist === 'function') dcells = map.dist(S, L);
  else { const a = pos(map, S), b = pos(map, L); dcells = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
  if (!isFinite(dcells)) dcells = 0;

  const loss = 20 * Math.log10(Math.max(1, dcells * 4)) + occlusion + (Number(snd.occlusion) || 0);
  const level = sourceDb - loss;
  let ambient = typeof env.ambientDb === 'number' ? env.ambientDb : 32;
  if (env.rain === false) ambient -= 4;
  const margin = level - ambient;
  return { heard: level > ambient, level: level, margin: margin, dcells: dcells, occlusion: occlusion };
}

function localize(npcsId, snd, aud, map) {
  const exact = fullId(map, snd && snd.cell);
  if (!aud) return exact;
  if (aud.dcells === 0 || aud.margin > 14) return exact;
  const j = rng.jitter(String(npcsId) + ':' + exact, 1);
  if (j === 0) return exact;
  const ns = (map && typeof map.neighbors === 'function') ? map.neighbors(exact) : [];
  if (!ns.length) return exact;
  return j > 0 ? ns[0].id : ns[ns.length - 1].id;
}

module.exports = { MATERIAL: MATERIAL, lightAt: lightAt, audible: audible, localize: localize, falloff: falloff };
