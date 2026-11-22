// Full automated playthrough — walks to objectives using real move actions.
const {makeEngine}=require('../engine/engine');
const {makeWorld}=require('../engine/world');
const {makeAccount}=require('../engine/account');
const {CAMPAIGN}=require('../content/campaign');

function fmt(s){const m=Math.floor(s/60)%60,h=Math.floor(s/3600);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function boot(id){
  const {world,mapDef}=makeWorld(id,makeAccount());
  return {eng:makeEngine({world,mapDef,ambientDb:32,rain:false}),world};
}
function walkTo(eng,world,target){
  target='L0-'+String(target).replace('L0-','');
  let guard=0;
  while(world.player.cell!==target&&guard++<20){
    const p=eng.map.path(world.player.cell,target,{});
    if(!p||p.length<2)return false;
    eng.turn({type:'move',cell:p[1]});
  }
  return world.player.cell===target;
}

let wins=0;
for(const m of CAMPAIGN.missions){
  console.log('\n====== '+m.id+' : '+m.name+' ======');
  const {eng,world}=boot(m.id);
  world.player.ammo=99;
  // order objectives: eliminate/deactivate/copy first, extract last
  const ordered=[...world.objectives].sort((a,b)=>(a.type==='extract')-(b.type==='extract'));
  for(const o of ordered){
    let done=false;
    for(let attempt=0;attempt<6&&!done;attempt++){
      if(o.type==='eliminate'){
        const t=world.npcs.find(n=>n.id===o.target);
        if(!t||t.alive===false){done=true;break}
        if(!walkTo(eng,world,eng.map.normalize(world.positions[t.id].cell||t.cell).slice(3))){
          // cannot reach — shoot from here if LOS
          const r=eng.turn({type:'shoot',target:t.id,aim:'head'});
          done=!!(r.action&&r.action.hit===t.id);
        } else {
          const r=eng.turn({type:'shoot',target:t.id,aim:'head'});
          done=!!(r.action&&r.action.hit===t.id);
        }
      } else if(o.type==='copy'||o.type==='deactivate'){
        if(walkTo(eng,world,o.target)){
          const r=eng.turn({type:o.type,cell:'L0-'+o.target});
          done=!!(o.done);
        }
      } else if(o.type==='extract'){
        if(walkTo(eng,world,o.target)){done=true}
      } else if(o.type==='survive'){
        eng.turn({type:'wait',seconds:12});done=true;
      }
    }
    console.log('  '+o.type+'@'+o.target+': '+(o.done?'DONE':'INCOMPLETE'));
  }
  const v=eng.playerView();
  console.log('  FINAL:',v.mission,'| done',world.objectives.filter(o=>o.done).length+'/'+world.objectives.length,
    '| clock',fmt(world.clock),'| heat',Math.round(v.heat),'| compromised',world.compromised);
  if(v.mission==='COMPLETE')wins++;
}
console.log('\nMISSIONS COMPLETED: '+wins+'/'+CAMPAIGN.missions.length);
