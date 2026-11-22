// Build a runnable world from a campaign mission definition.
const {MAPS}=require('../content/maps');
const {CAMPAIGN}=require('../content/campaign');

function makeWorld(missionId,account){
  const mission=CAMPAIGN.missions.find(m=>m.id===missionId)||CAMPAIGN.missions[0];
  const def=MAPS[mission.mapId];
  if(!def)throw new Error('No map '+mission.mapId);
  const enemies=mission.enemies.map(e=>Object.assign({},e,{alive:true,carried:e.carried||[]}));
  const positions={};
  for(const e of enemies)positions[e.id]={cell:(def.level||'L0')+'-'+e.cell,mode:'patrol',target:null,movedAt:0,facing:e.facing||'S'};
  const doors={};
  for(const [a,b,t] of (def.edges||[]))if(t==='door')doors[[a,b].sort().join('|')]='closed';
  for(const k in (def.doors||{}))doors[k]=def.doors[k];
  // Ammo/weapon are derived from carried gear, never hardcoded.
  const FIRARM_AMMO={pistol:15+1,revolver:6,smg:30,rifle:20};
  const gearList=(account&&account.gear)||['knife','lockpick'];
  const carriedGun=['rifle','smg','pistol','revolver'].find(g=>gearList.includes(g))||null;
  const world={
    campaign:CAMPAIGN.title,missionId:mission.id,missionName:mission.name,
    level:def.level||'L0',clock:0,deadline:mission.deadline||900,
    player:{cell:(def.level||'L0')+'-'+mission.insert.cell,facing:mission.insert.facing||'N',
      posture:mission.insert.posture||'crouch',hp:100,wounds:[],
      gun:carriedGun,ammo:carriedGun?(FIRARM_AMMO[carriedGun]||0):0,
      gear:gearList,sway:0.14,darkness:0.85,movedAt:0},
    npcs:enemies,positions,doors,
    sounds:[],evidence:[],messages:[],observations:[],movementLog:[],
    objectives:(mission.objectives||[]).map(o=>Object.assign({},o,{done:false})),
    exit:mission.exit,rewards:mission.rewards,radioChannel:'SEC',
    deadman:!!(mission.deadman||mission.intel&&mission.intel.deadman),
    triggerDisarmed:false,triggerArmedAt:null,triggerFired:false,
    lockdown:false,compromised:false,objectivesDone:false,
    resolver:mission.resolver||[],kills:0,
    missionDef:{},missionState:null,heat:null,resolvedEvents:[],
    briefing:mission.brief,intel:mission.intel||{}
  };
  return{world,mapDef:def,mission};
}

module.exports={makeWorld};
