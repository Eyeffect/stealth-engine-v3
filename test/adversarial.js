// Adversarial checks — the things I tend to claim without verifying.
const {makeEngine}=require('../engine/engine');
const {makeWorld}=require('../engine/world');
const {makeAccount}=require('../engine/account');
let pass=0,fail=0;
function check(n,c,d){if(c){pass++;console.log('  PASS  '+n)}else{fail++;console.log('  FAIL  '+n+(d?' — '+d:''))}}
function boot(id,acct){const {world,mapDef}=makeWorld(id,acct||makeAccount());return {e:makeEngine({world,mapDef,ambientDb:32,rain:false}),world}}
function fmt(s){const m=Math.floor(s/60)%60,h=Math.floor(s/3600);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}

console.log('\n== DEAD-MAN TRIGGER FULL PATH ==');
{
  const {e,world}=boot('m2_auditor');
  world.deadman=true;
  const t=world.npcs.find(n=>n.role==='target');
  t.alive=false; // killed without disarming
  e.turn({type:'wait',seconds:1});
  check('trigger arms',!!world.triggerArmedAt,String(world.triggerArmedAt));
  for(let i=0;i<20;i++)e.turn({type:'wait',seconds:6});
  check('trigger fires',world.triggerFired===true);
  check('mission compromised',world.compromised===true);
  check('mission FSM FAIL',e.mission.state==='COMPROMISED',e.mission.state);
}
console.log('\n== DEAD-MAN DISARMED ==');
{
  const {e,world}=boot('m2_auditor');
  world.deadman=true;
  const t=world.npcs.find(n=>n.role==='target');
  e.world.player.cell='L0-D4';
  world.player.gear.push('decoder');
  world.decoder=true;
  e.turn({type:'deactivate',cell:'L0-D4'});
  check('switch disarmed',world.triggerDisarmed===true);
  t.alive=false;
  for(let i=0;i<20;i++)e.turn({type:'wait',seconds:6});
  check('trigger stays quiet when disarmed',world.triggerFired===false);
}
console.log('\n== HEAT LOCKDOWN ==');
{
  const {e,world}=boot('m1_manifest');
  for(let i=0;i<20;i++)e.turn({type:'wait',seconds:1,noise:90});
  check('lockdown reached',world.lockdown===true,'heat '+Math.round(e.heat.global()));
}
console.log('\n== SAVE / LOAD ==');
{
  const {e,world}=boot('m1_manifest');
  e.turn({type:'wait',seconds:5});
  const saved=e.save();
  const {e:e2}=boot('m1_manifest');
  e2.load(saved);
  check('save/load restores clock',e2.world.clock===world.clock,e2.world.clock+' vs '+world.clock);
}
console.log('\n== ACCOUNT PERSISTENCE ACROSS CAMPAIGN ==');
{
  const a=makeAccount();
  const before=a.credits;
  for(const m of ['m1_manifest','m2_auditor','m3_glasshouse']){
    const {e,world}=boot(m,a);
    world.player.ammo=99;
    for(const o of world.objectives){
      if(o.type==='eliminate'){const t=world.npcs.find(n=>n.id===o.target);if(t){world.player.cell=world.positions[t.id].cell;e.turn({type:'shoot',target:t.id})}}
      else if(o.type==='copy'||o.type==='deactivate'){world.player.cell='L0-'+o.target;for(let k=0;k<4&&!o.done;k++)e.turn({type:o.type,cell:'L0-'+o.target})}
      else if(o.type==='extract'){world.player.cell='L0-'+o.target;e.turn({type:'move',cell:'L0-'+o.target})}
    }
    a.applyResult({success:true,kills:1,credits:100});
    a.recordMission({id:m,result:'COMPLETE',kills:1,creditsEarned:100});
  }
  check('3 missions recorded',a.missions.length===3);
  check('credits accumulated',a.credits===before+300,String(a.credits));
}
console.log('\n== AIM SWAY AFFECTS SHOT ==');
{
  const {e,world}=boot('m2_auditor');
  const t=world.npcs.find(n=>n.role==='target');
  world.player.sway=0.45;
  world.player.ammo=200;
  let hits=0,shots=0;
  for(let i=0;i<30;i++){
    world.player.cell=world.positions[t.id].cell;
    const r=e.turn({type:'shoot',target:t.id});
    shots++;
    if(r.action&&r.action.hit)hits++;
    if(t.alive===false)break;
  }
  check('high sway reduces accuracy',hits<shots,String(hits)+'/'+shots);
}
console.log('\n==== '+pass+' passed, '+fail+' failed ====');
process.exit(fail?1:0);
