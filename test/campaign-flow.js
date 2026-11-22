// Full campaign flow: unlock → play → finish → next unlock → save/load.
const {makeCampaign}=require('../campaign');
const {CAMPAIGN}=require('../content/campaign');
let pass=0,fail=0;
function check(n,c,d){if(c){pass++;console.log('  PASS  '+n)}else{fail++;console.log('  FAIL  '+n+(d?' — '+d:''))}}
function walk(e,world,target){
  target='L0-'+String(target).replace('L0-','');
  let g=0;
  while(world.player.cell!==target&&g++<25){
    const p=e.map.path(world.player.cell,target,{});
    if(!p||p.length<2)return false;
    e.turn({type:'move',cell:p[1]});
  }
  return world.player.cell===target;
}

const c=makeCampaign();
c.unlocked=[CAMPAIGN.missions[0].id];c.completed=[];
check('only first mission unlocked',c.available().length===1);
check('second locked',!c.unlocked.includes('m2_auditor'));

for(const m of CAMPAIGN.missions){
  const s=c.start(m.id);
  check(m.id+' starts',s.ok);
  const {eng:e,world}=s;
  world.player.ammo=99;
  if(world.player.gear.indexOf('decoder')<0)world.player.gear.push('decoder');
  world.decoder=true;
  const ordered=[...world.objectives].sort((a,b)=>(a.type==='extract')-(b.type==='extract'));
  for(const o of ordered){
    for(let k=0;k<6&&!o.done;k++){
      if(o.type==='eliminate'){
        const t=world.npcs.find(n=>n.id===o.target);
        if(t&&t.alive!==false){walk(e,world,e.map.normalize(world.positions[t.id].cell||t.cell).slice(3));e.turn({type:'shoot',target:t.id,aim:'head'})}
      } else if(o.type==='copy'||o.type==='deactivate'){
        if(walk(e,world,o.target))e.turn({type:o.type,cell:'L0-'+o.target});
      } else if(o.type==='extract'){
        walk(e,world,o.target);
        e.turn({type:'extract',cell:'L0-'+String(o.target).replace('L0-','')});
      } else if(o.type==='survive'){e.turn({type:'wait',seconds:12});o.done=true}
    }
  }
  const success=e.mission.state==='COMPLETE';
  check(m.id+' completes',success,e.mission.state);
  c.finish(m.id,e,world,success);
}
check('all 3 completed',c.completed.length===3,c.completed.join(','));
check('credits grew',c.account.credits>25000,String(c.account.credits));
check('missions logged',c.account.missions.length===3);
c.save();
const c2=makeCampaign();
check('save/load works',c2.load()&&c2.completed.length===3);
check('account survives load',c2.account.credits===c.account.credits);
console.log('\n==== '+pass+' passed, '+fail+' failed ====');
process.exit(fail?1:0);
