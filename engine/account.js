// engine/account.js — persistent operator profile.
'use strict';

const DEFAULTS = {
  credits: 25000,
  reputation: 50,
  gear: ['knife', 'lockpick'],
  missions: [],
  kills: 0
};

function num(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function makeAccount(data) {
  data = data || {};
  const acct = {
    credits: num(data.credits, DEFAULTS.credits),
    reputation: num(data.reputation, DEFAULTS.reputation),
    gear: Array.isArray(data.gear) ? data.gear.slice() : DEFAULTS.gear.slice(),
    missions: Array.isArray(data.missions) ? data.missions.slice() : [],
    kills: num(data.kills, DEFAULTS.kills)
  };

  function canAfford(cost) { return acct.credits >= num(cost, Infinity); }

  // catalog is keyed by item id with a `.cost` field (e.g. content/items.ITEMS).
  function buy(itemId, catalog) {
    const id = String(itemId);
    const entry = catalog && catalog[id];
    if (!entry) return { ok: false, reason: 'unknown', itemId: id };
    const cost = num(entry.cost, 0);
    if (!canAfford(cost)) {
      return { ok: false, reason: 'unaffordable', itemId: id, cost: cost, credits: acct.credits };
    }
    acct.credits -= cost;
    acct.gear.push(id);
    return { ok: true, itemId: id, cost: cost, credits: acct.credits };
  }

  function recordMission(record) {
    record = record || {};
    const entry = {
      id: record.id,
      result: record.result,
      time: record.time == null ? new Date().toISOString() : record.time,
      kills: num(record.kills, 0),
      creditsEarned: num(record.creditsEarned, 0)
    };
    acct.missions.push(entry);
    return entry;
  }

  // Apply the outcome of a mission. `rep` is a reputation delta; `credits` and
  // `kills` are additive. When `rep` is omitted, success/fail nudges reputation
  // by +2/-2 as a sensible default.
  function applyResult(result) {
    result = result || {};
    const creditDelta = num(result.credits, 0);
    const killDelta = num(result.kills, 0);
    let repDelta;
    if (result.rep != null) repDelta = num(result.rep, 0);
    else repDelta = result.success ? 2 : -2;
    acct.credits += creditDelta;
    acct.kills += killDelta;
    acct.reputation += repDelta;
    return {
      credits: acct.credits,
      reputation: acct.reputation,
      kills: acct.kills,
      success: !!result.success
    };
  }

  function dump() {
    return {
      credits: acct.credits,
      reputation: acct.reputation,
      gear: acct.gear.slice(),
      missions: acct.missions.map(m => Object.assign({}, m)),
      kills: acct.kills
    };
  }

  function load(obj) {
    obj = obj || {};
    acct.credits = num(obj.credits, DEFAULTS.credits);
    acct.reputation = num(obj.reputation, DEFAULTS.reputation);
    acct.gear = Array.isArray(obj.gear) ? obj.gear.slice() : DEFAULTS.gear.slice();
    acct.missions = Array.isArray(obj.missions) ? obj.missions.map(m => Object.assign({}, m)) : [];
    acct.kills = num(obj.kills, DEFAULTS.kills);
    return acct;
  }

  acct.canAfford = canAfford;
  acct.buy = buy;
  acct.recordMission = recordMission;
  acct.applyResult = applyResult;
  acct.dump = dump;
  acct.load = load;
  return acct;
}

module.exports = { makeAccount: makeAccount, DEFAULTS: DEFAULTS };
