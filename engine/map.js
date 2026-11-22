// engine/map.js — map construction, grid geometry, line-of-sight and BFS pathfinding.
'use strict';

const CELL_M = 4;
const DIRS = [
  { name: 'N', x: 0, y: 1 },
  { name: 'S', x: 0, y: -1 },
  { name: 'E', x: 1, y: 0 },
  { name: 'W', x: -1, y: 0 }
];
const FULL_RE = /^(L[01])-([A-F])([1-5])$/;
const SHORT_RE = /^([A-F])([1-5])$/;
const EDGE_TYPES = { open: 1, door: 1, glass: 1, wall: 1 };

// 8-connected Bresenham walk. Consecutive cells differ by at most one on each
// axis, so a step is either orthogonal or a single diagonal.
function bresenhamCells(x0, y0, x1, y1) {
  const out = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : (x0 > x1 ? -1 : 0);
  const sy = y0 < y1 ? 1 : (y0 > y1 ? -1 : 0);
  let err = dx - dy;
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return out;
}

function makeMap(def) {
  def = def || {};
  const cells = {};
  const edgeMap = new Map();
  const xyIndex = {};
  const doors = {};
  const defaultLevel = (def.level === 'L0' || def.level === 'L1') ? def.level : 'L0';

  function canonFull(id) {
    if (id == null) return null;
    const m = String(id).trim().toUpperCase().match(FULL_RE);
    return m ? m[1] + '-' + m[2] + m[3] : null;
  }
  function canonShort(id) {
    if (id == null) return null;
    const m = String(id).trim().toUpperCase().match(SHORT_RE);
    return m ? m[1] + m[2] : null;
  }
  function parseFull(id) {
    const m = String(id == null ? '' : id).match(FULL_RE);
    return m ? { level: m[1], x: m[2].charCodeAt(0) - 65, y: Number(m[3]) - 1 } : null;
  }

  // Resolve a full OR short id to a full id. A short id is matched against the
  // cells we know about; when ambiguous we prefer the map's default level.
  function resolveId(id) {
    const full = canonFull(id);
    if (full) return full;
    const short = canonShort(id);
    if (!short) return id == null ? id : String(id);
    const hits = Object.keys(cells).filter(k => k.endsWith('-' + short));
    if (hits.length === 1) return hits[0];
    const preferred = defaultLevel + '-' + short;
    if (cells[preferred]) return preferred;
    return hits.length ? hits[0] : preferred;
  }
  function normalize(id) { return resolveId(id); }

  function edgeKey(a, b) {
    const A = normalize(a), B = normalize(b);
    return A < B ? A + '|' + B : B + '|' + A;
  }
  function normalizeDoorKey(key) {
    return String(key).split('|').map(s => normalize(s.trim())).sort().join('|');
  }

  // ---- build cells (def keys may be short or full) ----
  const cellDefs = def.cells || {};
  Object.keys(cellDefs).forEach(raw => {
    const v = cellDefs[raw] || {};
    let full = canonFull(raw);
    const short = canonShort(raw);
    if (!full && short) {
      const lv = (v.level === 'L0' || v.level === 'L1') ? v.level : defaultLevel;
      full = lv + '-' + short;
    }
    const p = full ? parseFull(full) : null;
    if (!p) return;
    cells[full] = {
      m: typeof v.m === 'string' ? v.m : 'tile',
      n: typeof v.n === 'string' ? v.n : '',
      level: p.level, x: p.x, y: p.y
    };
    xyIndex[p.level + '|' + p.x + ',' + p.y] = full;
  });

  // ---- build edges ----
  const edgeDefs = Array.isArray(def.edges) ? def.edges : [];
  edgeDefs.forEach(e => {
    if (!Array.isArray(e) || e.length < 3) return;
    const typeRaw = String(e[2] == null ? 'wall' : e[2]).toLowerCase();
    const type = EDGE_TYPES[typeRaw] ? typeRaw : 'wall';
    const width = (typeof e[3] === 'number' && isFinite(e[3])) ? e[3] : undefined;
    const a = normalize(e[0]), b = normalize(e[1]);
    edgeMap.set(edgeKey(a, b), { a: a, b: b, type: type, width: width });
  });

  // ---- door states ----
  const doorDefs = def.doors || {};
  Object.keys(doorDefs).forEach(k => { doors[normalizeDoorKey(k)] = doorDefs[k]; });

  function idAtLevel(level, x, y) {
    const key = level + '|' + x + ',' + y;
    if (xyIndex[key]) return xyIndex[key];
    return level + '-' + String.fromCharCode(65 + x) + (y + 1);
  }

  function edgeType(a, b) {
    const e = edgeMap.get(edgeKey(a, b));
    return e ? e.type : null;
  }
  function edgeWidth(a, b) {
    const e = edgeMap.get(edgeKey(a, b));
    if (!e) return 0;
    if (typeof e.width === 'number' && isFinite(e.width) && e.width > 0) return e.width;
    if (e.type === 'door') return 0.9;
    if (e.type === 'open') return CELL_M;
    return 0;
  }
  function setDoor(key, state) { doors[normalizeDoorKey(key)] = state; return state; }
  function getDoor(key) { return doors[normalizeDoorKey(key)]; }
  function doorOpen(a, b, openDoors) {
    const k = edgeKey(a, b);
    if (openDoors && openDoors.has(k)) return true;
    return doors[k] === 'open';
  }
  function passableEdge(a, b, openDoors) {
    const t = edgeType(a, b);
    if (t === 'open' || t === 'glass') return true;
    if (t === 'door') return doorOpen(a, b, openDoors);
    return false;
  }

  function neighbors(id) {
    const f = normalize(id);
    const c = cells[f];
    if (!c) return [];
    const out = [];
    DIRS.forEach(d => {
      const nid = xyIndex[c.level + '|' + (c.x + d.x) + ',' + (c.y + d.y)];
      if (nid) out.push({ id: nid, type: edgeType(f, nid) });
    });
    return out;
  }

  function xy(id) {
    const p = parseFull(normalize(id));
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }
  function dist(a, b) {
    const A = xy(a), B = xy(b);
    return Math.sqrt((A.x - B.x) * (A.x - B.x) + (A.y - B.y) * (A.y - B.y));
  }

  function los(a, b, opts) {
    opts = opts || {};
    const A = normalize(a), B = normalize(b);
    let openDoors = opts.openDoors;
    if (!(openDoors instanceof Set)) {
      openDoors = new Set(
        openDoors == null ? [] :
          (Array.isArray(openDoors) ? openDoors : [openDoors]).map(normalizeDoorKey)
      );
    }
    let walls = 0, doors = 0, glass = 0;
    const steps = [];
    const pa = parseFull(A), pb = parseFull(B);
    if (!pa || !pb) {
      walls = 1;
      steps.push({ from: A, to: B, type: 'wall' });
    } else if (A !== B) {
      const pts = bresenhamCells(pa.x, pa.y, pb.x, pb.y);
      const ids = pts.map(p => idAtLevel(pa.level, p.x, p.y));
      ids[0] = A;
      ids[ids.length - 1] = B;
      for (let i = 1; i < ids.length; i++) {
        const from = ids[i - 1], to = ids[i];
        const pf = parseFull(from), pt = parseFull(to);
        const dx = pt.x - pf.x, dy = pt.y - pf.y;
        const diagonal = dx !== 0 && dy !== 0;
        let type = edgeType(from, to);
        let cat = null;
        if (diagonal) {
          // Cutting a corner is only allowed when BOTH orthogonal edges are
          // passable. Otherwise the whole step is treated as a wall.
          const o1 = idAtLevel(pa.level, pf.x + dx, pf.y);
          const o2 = idAtLevel(pa.level, pf.x, pf.y + dy);
          if (!passableEdge(from, o1, openDoors) || !passableEdge(from, o2, openDoors)) {
            cat = 'wall';
            type = 'wall';
          } else if (type === null) {
            // No declared diagonal edge: an open corner still permits sight.
            type = 'open';
            cat = 'none';
          }
        }
        if (!cat) {
          if (type === null || type === 'wall') cat = 'wall';
          else if (type === 'door') cat = doorOpen(from, to, openDoors) ? 'none' : 'door';
          else if (type === 'glass') cat = 'glass';
          else cat = 'none';
        }
        if (cat === 'wall') walls++;
        else if (cat === 'door') doors++;
        else if (cat === 'glass') glass++;
        steps.push({ from: from, to: to, type: cat === 'wall' ? 'wall' : (type || 'wall') });
      }
    }
    return { clear: walls === 0 && doors === 0, walls: walls, doors: doors, glass: glass, steps: steps };
  }

  function path(a, b, opts) {
    const A = normalize(a), B = normalize(b);
    if (!cells[A] || !cells[B]) return null;
    if (A === B) return [A];
    const prev = {}, seen = {}, queue = [A];
    seen[A] = true;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const ns = neighbors(cur);
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        if (seen[n.id]) continue;
        // ANY door is passable for NPC movement; glass and walls are not.
        if (n.type !== 'open' && n.type !== 'door') continue;
        seen[n.id] = true;
        prev[n.id] = cur;
        if (n.id === B) {
          const out = [B];
          let c = B;
          while (c !== A) { c = prev[c]; out.push(c); }
          return out.reverse();
        }
        queue.push(n.id);
      }
    }
    return null;
  }

  function level(id) {
    const p = parseFull(normalize(id));
    return p ? p.level : defaultLevel;
  }
  function material(id) { const c = cells[normalize(id)]; return c ? c.m : 'tile'; }
  function roomName(id) { const c = cells[normalize(id)]; return c ? c.n : ''; }

  return {
    def: def,
    cells: cells,
    doors: doors,
    CELL_M: CELL_M,
    setDoor: setDoor,
    getDoor: getDoor,
    edgeType: edgeType,
    edgeWidth: edgeWidth,
    neighbors: neighbors,
    dist: dist,
    xy: xy,
    los: los,
    path: path,
    level: level,
    material: material,
    roomName: roomName,
    normalize: normalize,
    edgeKey: edgeKey
  };
}

module.exports = { makeMap: makeMap, DIRS: DIRS, CELL_M: CELL_M };
