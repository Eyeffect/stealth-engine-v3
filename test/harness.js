// Automated self-play + invariant checker.
const {makeEngine}=require('../engine/engine');
const {makeWorld}=require('../engine/world');
const {makeAccount}=require('../engine/account');
const {CAMPAIGN}=require('../content/campaign');

let pass=0,fail=0;
function check(name,cond,detail){
  if(cond){pass++;console.log('  PASS  '+name)}
  else{fail++;console.log('  FAIL  '+name+(detail?' — '+detail:''))}
}
function boot(id,acct){
  const {world,mapDef}=makeWorld(id,acct||makeAccount());
  return makeEngine({world,mapDef,ambientDb:32,rain:false});
}
function fmt(s){const m=Math.floor(s/60)%60,h=Math.floor(s/3600);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}

// ---------- structural tests ----------
console.log('\n== STRUCTURE ==');
check('3 missions in campaign',CAMPAIGN.missions.length===3);
for(const m of CAMPAIGN.missions){
  const e=boot(m.id);
  const v=e.playerView();
  check(m.id+' boots',!!v.you.cell);
  check(m.id+' starts BRIEFING',v.mission==='BRIEFING');
  check(m.id+' has objectives',v.objectives.length>0);
  check(m.id+' has enemies',e.world.npcs.length>=5);
}

// ---------- mission FSM ----------
console.log('\n== MISSION STATE ==');
{
  const e=boot('m1');
  e.turn({type:'wait',seconds:1});
  check('BRIEFING -> OBJECTIVE on first turn',e.mission.state==='OBJECTIVE',e.mission.state);
}

// ---------- no event re-fire ----------
console.log('\n== EVENT LEDGER ==');
{
  const e=boot('m1');
  const before=e.world.evidence.length;
  const l=e.ledger;
  const r1=l.resolveOnce('T-TEST',()=>42);
  const r2=l.resolveOnce('T-TEST',()=>99);
  check('resolveOnce fires once',r1.fired&&r1.result===42&&!r2.fired);
  check('evidence stable across turns',(function(){const b=e.world.evidence.length;e.turn({type:'wait',seconds:1});e.turn({type:'wait',seconds:1});return e.world.evidence.length===b})());
}

// ---------- time advances deterministically ----------
console.log('\n== TIME COSTS ==');
{
  const e=boot('m1');
  const t0=e.world.clock;
  e.turn({type:'wait',seconds:10});
  check('wait advances clock by 10',e.world.clock===t0+10,e.world.clock+' vs '+(t0+10));
}

// ---------- shots: body blocking ----------
console.log('\n== SHOT RESOLUTION ==');
{
  const e=boot('m2_auditor');
  // place a shield in front of the target
  const shield=e.world.npcs.find(n=>n.role==='bodyguard');
  const target=e.world.npcs.find(n=>n.role==='target');
  e.world.player.cell=e.world.player.cell;
  if(shield&&target){
    // force both into same cell adjacent to player
    const pcell=e.world.player.cell;
    const near=e.map.neighbors(pcell).filter(n=>n.type!=='wall'&&n.type!=='glass');
    if(near.length){
      const c=near[0].id;
      // shield in intermediate cell, target one cell further along the path
      const beyond=e.map.neighbors(c).filter(n=>n.type!=='wall'&&n.type!=='glass'&&n.id!==e.world.player.cell);
      const tcell=beyond.length?beyond[0].id:c;
      e.world.positions[shield.id]={cell:c,mode:'shield',movedAt:0};
      e.world.positions[target.id]={cell:tcell,mode:'compose',movedAt:0};
      e.world.player.ammo=40;
      let hitResult=null;
      for(let i=0;i<20&&!hitResult;i++){
        const r=e.turn({type:'shoot',target:target.id,aim:'center'});
        if(r.action&&r.action.hit)hitResult=r.action;
      }
      check('shot resolves',!!hitResult);
      check('shield blocks shot',!!hitResult&&(hitResult.blocked===true||hitResult.hit===shield.id),
        JSON.stringify(hitResult));
      check('target survives blocked shot',target.alive!==false);
    } else check('shot test has adjacent cell',false);
  } else check('shot test has shield+target',false);
}

// ---------- dead man trigger ----------
console.log('\n== DEAD MAN TRIGGER ==');
{
  const e=boot('m2_auditor');
  e.world.deadman=true;
  const tgt=e.world.objectives.find(o=>o.type==='eliminate');
  if(tgt){
    const n=e.world.npcs.find(x=>x.id===tgt.target);
    if(n){n.alive=false;e.world.clock=0;
      e.turn({type:'wait',seconds:1});
      check('trigger arms on target death',!!e.world.triggerArmedAt,String(e.world.triggerArmedAt));}
    else check('trigger test has target npc',false);
  } else check('trigger test has eliminate objective',false);
}

// ---------- heat escalation ----------
console.log('\n== HEAT ==');
{
  const e=boot('m1');
  for(let i=0;i<8;i++)e.turn({type:'wait',seconds:1,noise:80});
  const h=e.heat.status();
  check('heat rises on noise',h.global>0,h.global);
}

// ---------- fog of war: player view has no GM keys ----------
console.log('\n== FOG OF WAR ==');
{
  const e=boot('m3');
  const v=e.playerView();
  const s=JSON.stringify(v);
  check('no beliefs leaked',s.indexOf('beliefs')<0);
  check('no brain trace leaked',s.indexOf('brainTrace')<0);
  check('no heat internals leaked',s.indexOf('fired')<0);
  check('only global heat shown',typeof v.heat==='number');
}

// ---------- account ----------
console.log('\n== ACCOUNT ==');
{
  const a=makeAccount();
  const before=a.credits;
  const r=a.buy('pistol',require('../content/items').ITEMS);
  check('account buy works',r&&a.credits<before);
  a.applyResult({success:true,kills:2,credits:100});
  a.recordMission({id:'m1',result:'COMPLETE',kills:2,creditsEarned:100});
  check('mission result recorded',a.missions.length===1);
}

// ---------- sustained self-play: 40 turns per mission ----------
console.log('\n== SELF-PLAY (40 turns each) ==');
for(const m of CAMPAIGN.missions){
  const e=boot(m.id);
  let turns=0,errs=0;
  try{
    for(let i=0;i<40;i++){
      const acts=[{type:'wait',seconds:3},{type:'crouch'},{type:'stand'},{type:'openDoor',cell:e.map.neighbors(e.world.player.cell)[0].id}];
      const r=e.turn(acts[i%acts.length]);
      if(!r||typeof r.clock!=='number')errs++;
      turns++;
    }
  }catch(ex){errs++;console.log('  EXCEPTION in '+m.id+': '+ex.message)}
  check(m.id+' survives 40 turns',turns===40&&errs===0,turns+' turns, '+errs+' errors');
  check(m.id+' clock advanced',e.world.clock>0,e.world.clock);
}

console.log('\n==== '+pass+' passed, '+fail+' failed ====');
process.exit(fail?1:0);
