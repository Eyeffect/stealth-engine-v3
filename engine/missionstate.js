// engine/missionstate.js — finite state machine for mission progression.
'use strict';

const STATES = ['BRIEFING', 'INFILTRATION', 'OBJECTIVE', 'EXTRACTION', 'COMPLETE', 'COMPROMISED'];

// Allowed (state,event) -> next state. FAIL is handled globally below.
const TRANSITIONS = {
  BRIEFING: { START: 'INFILTRATION' },
  INFILTRATION: { ENTER: 'OBJECTIVE' },
  OBJECTIVE: { OBJECTIVE_DONE: 'EXTRACTION', EXTRACT: 'EXTRACTION' },
  EXTRACTION: { COMPLETE: 'COMPLETE', EXTRACT: 'COMPLETE' },
  COMPLETE: {},
  COMPROMISED: {}
};
const TERMINAL = { COMPLETE: true, COMPROMISED: true };

function makeMission(def) {
  def = def || {};
  let state = STATES.indexOf(def.state) >= 0 ? def.state
    : (STATES.indexOf(def.initial) >= 0 ? def.initial : 'BRIEFING');
  const history = [];
  const log = [];

  function advance(event) {
    event = String(event);
    let to = null;
    if (event === 'FAIL') {
      to = 'COMPROMISED';
    } else if (TRANSITIONS[state] && TRANSITIONS[state][event]) {
      to = TRANSITIONS[state][event];
    }
    if (!to) {
      const msg = 'invalid transition: ' + state + ' --' + event + '--> (ignored)';
      log.push(msg);
      console.warn('[missionstate] ' + msg);
      return false;
    }
    const from = state;
    state = to;
    history.push({ from: from, to: to, event: event, ts: new Date().toISOString() });
    return true;
  }

  function isActive() { return !TERMINAL[state]; }

  function dump() {
    return {
      def: def,
      state: state,
      history: history.map(h => ({ from: h.from, to: h.to, event: h.event, ts: h.ts })),
      log: log.slice()
    };
  }

  function load(obj) {
    obj = obj || {};
    state = STATES.indexOf(obj.state) >= 0 ? obj.state : 'BRIEFING';
    history.length = 0;
    (Array.isArray(obj.history) ? obj.history : []).forEach(h => {
      history.push({ from: h.from, to: h.to, event: h.event, ts: h.ts });
    });
    log.length = 0;
    (Array.isArray(obj.log) ? obj.log : []).forEach(l => log.push(String(l)));
    return mission;
  }

  const mission = {
    def: def,
    get state() { return state; },
    advance: advance,
    history: history,
    isActive: isActive,
    dump: dump,
    load: load,
    log: log,
    states: STATES.slice()
  };
  return mission;
}

module.exports = { makeMission: makeMission, STATES: STATES };
