// engine/ledger.js — one-shot event ledger.
// Guarantees that an id's callback fires exactly once, including across
// dump()/load() persistence cycles. Fixes "events re-fire every turn".
'use strict';

function makeLedger(initial) {
  // `known` is the universe of event ids (so unresolved() has something to
  // report). `resolved` maps id -> result of the callback that fired for it.
  const known = new Set();
  const resolved = new Map();

  function remember(id) { known.add(String(id)); }

  function seed(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(id => remember(id));
    } else if (obj && typeof obj === 'object') {
      // dump() format: {ids:[...], resolved:{id:result}}
      if (Array.isArray(obj.ids)) obj.ids.forEach(id => remember(id));
      if (obj.resolved && typeof obj.resolved === 'object') {
        Object.keys(obj.resolved).forEach(id => {
          remember(id);
          resolved.set(String(id), obj.resolved[id]);
        });
      }
      // A plain object: each key is a known id whose value is its result.
      if (!Array.isArray(obj.ids) && !obj.resolved) {
        Object.keys(obj).forEach(id => {
          remember(id);
          resolved.set(String(id), obj[id]);
        });
      }
    }
  }
  seed(initial);

  function has(id) { return resolved.has(String(id)); }

  function resolveOnce(id, fn, context) {
    id = String(id);
    remember(id);
    if (resolved.has(id)) return { fired: false, result: null };
    const result = (typeof fn === 'function') ? fn(context) : fn;
    resolved.set(id, result);
    return { fired: true, result: result };
  }

  function resolve(id, result) {
    id = String(id);
    remember(id);
    resolved.set(id, result);
    return result;
  }

  function unresolved() {
    return Array.from(known).filter(id => !resolved.has(id));
  }

  function dump() {
    const out = {};
    resolved.forEach((v, k) => { out[k] = v; });
    return { ids: Array.from(known), resolved: out };
  }

  function load(obj) {
    known.clear();
    resolved.clear();
    seed(obj);
    return ledger;
  }

  const ledger = {
    has: has,
    resolveOnce: resolveOnce,
    resolve: resolve,
    unresolved: unresolved,
    dump: dump,
    load: load
  };
  return ledger;
}

module.exports = { makeLedger: makeLedger };
