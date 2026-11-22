// Persistent game driver — one live world across turns, saved to game-state.json.
const fs=require('fs'),path=require('path');
const {makeEngine}=require('./engine/engine');
const {makeWorld}=require('./engine/world');
const {makeAccount}=require('./engine/account');
const {CAMPAIGN}=require('./content/campaign');
const {ITEMS}=require('./content/items');

const ROOT=__dirname;
const WORLD_FILE=path.join(ROOT,'game-state.json');
const LIVE_FILE=path.join(ROOT,'live.json');
const SNAP=path.join(ROOT,'ui','snapshot.json');

function freshWorld(missionId){
  const acct=fs.existsSync(LIVE_FILE)?makeAccount(JSON.parse(fs.readFileSync(LIVE_FILE,'utf8'))):makeAccount();
  return {worldData:null,missionId,acct:acct.dump()};
}
function boot(){
  if(fs.existsSync(WORLD_FILE)){
    const d=JSON.parse(fs.readFileSync(WORLD_FILE,'utf8'));
    const {world,mapDef}=makeWorld(d.missionId,makeAccount(d.acct));
    Object.assign(world,d.world);
    const eng=makeEngine({world,mapDef,ambientDb:32,rain:false,heatDecay:1});
    if(d.mapDoors)for(const k in d.mapDoors)eng.map.setDoor(k,d.mapDoors[k]);
    return{eng,world,mapDef,d};
  }
  const acct=fs.existsSync(LIVE_FILE)?makeAccount(JSON.parse(fs.readFileSync(LIVE_FILE,'utf8'))):makeAccount();
  const mid=(CAMPAIGN.missions[0]||{}).id;
  const {world,mapDef}=makeWorld(mid,acct);
  const eng=makeEngine({world,mapDef,ambientDb:32,rain:false,heatDecay:1});
  return{eng,world,mapDef,d:{missionId:mid,acct:acct.dump()}};
}
function save(eng,world,mapDef,d){
  fs.writeFileSync(WORLD_FILE,JSON.stringify({
    missionId:d.missionId,acct:d.acct,world:world,mapDoors:eng.map.doors
  },null,2));
}
function exportSnap(eng,world,mapDef,d,acct){
  // reuse the exporter logic by requiring it as a function would be cleaner; inline minimal
  const {CAMPAIGN:C}=require('./content/campaign');
  const m=C.missions.find(x=>x.id===d.missionId)||C.missions[0];
  const snap={
    generatedAt:new Date().toISOString(),exporterVersion:2,missionId:d.missionId,
    campaign:{title:C.title,story:C.story},
    mission:{id:m.id,name:m.name,brief:m.brief,mapId:m.mapId,deadline:m.deadline,exit:m.exit,
      rewards:m.rewards,enemies:m.enemies||[],cameras:m.cameras||[],intel:m.intel||{},
      objectives:world.objectives},
    mapEdges:mapDef.edges||[],
    map:{name:mapDef.name,level:world.level||'L0',ambient:mapDef.ambient,cells:eng.map.cells,
      edges:mapDef.edges||[],doors:eng.map.doors,lights:mapDef.lights||[]},
    view:eng.playerView(),overlays:eng.overlays(),diagnostics:eng.diagnostics(),
    contacts:eng.playerView().contacts,account:acct.dump(),items:ITEMS,
    actions:['move','crouch','stand','openDoor','closeDoor','wedge','shoot','don','gas',
      'copy','deactivate','search','drag','radio','extract','wait'].map(t=>({type:t,label:t.toUpperCase(),
      template:{type:t}}))
  };
  fs.writeFileSync(SNAP,JSON.stringify(snap,null,2)+'\n');
}

const args=process.argv.slice(2),cmd=args[0]||'view';
let {eng,world,mapDef,d}=boot();
const acct=makeAccount(d.acct);
if(cmd==='reset'){
  if(fs.existsSync(WORLD_FILE))fs.unlinkSync(WORLD_FILE);
  console.log('Game state reset');
}else if(cmd==='view'){
  console.log(JSON.stringify(eng.playerView(),null,2));
}else if(cmd==='act'){
  const a=args[1]&&args[1].indexOf('{')>=0?JSON.parse(args[1]):JSON.parse(fs.readFileSync(args[1]||path.join(ROOT,'action.json'),'utf8'));
  const before=world.player.cell;
  const r=eng.turn(a);
  save(eng,world,mapDef,d);
  exportSnap(eng,world,mapDef,d,acct);
  console.log('ACTION',JSON.stringify(r.action));
  console.log('MOVED',before,'->',world.player.cell,'| clock',world.clock,'| state',eng.mission.state,'| heat',Math.round(eng.heat.global()));
  console.log('VIEW',JSON.stringify(eng.playerView()));
}else if(cmd==='status'){
  console.log(JSON.stringify({mission:d.missionId,clock:world.clock,state:eng.mission.state,
    cell:world.player.cell,objectives:world.objectives,heat:Math.round(eng.heat.global())},null,2));
}
module.exports={boot,save,exportSnap};
