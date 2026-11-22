// CLI driver for v3 — lets me play-test each mission turn by turn.
const {makeEngine}=require('./engine/engine');
const {makeWorld}=require('./engine/world');
const {makeAccount}=require('./engine/account');

const args=process.argv.slice(2);
const cmd=args[0]||'help';
const missionId=args[1]||'m1';

function boot(){
  const acct=makeAccount();
  const {world,mapDef}=makeWorld(missionId,acct);
  const eng=makeEngine({world,mapDef,ambientDb:32,rain:false,heatDecay:1});
  return{eng,acct};
}

if(cmd==='help'){
  console.log(`v3 CLI
  node run.js view [missionId]
  node run.js act <missionId> <jsonAction>
  node run.js script <missionId> <jsonFile>   — run a list of actions
  node run.js diag [missionId]
Missions: m1 m2 m3`);
}else if(cmd==='view'){
  const {eng}=boot();
  console.log(JSON.stringify(eng.playerView(),null,2));
}else if(cmd==='act'){
  const {eng}=boot();
  const action=JSON.parse(args[2]);
  const r=eng.turn(action);
  console.log(JSON.stringify(r,null,2));
  console.log('\nPLAYER VIEW:\n'+JSON.stringify(eng.playerView(),null,2));
}else if(cmd==='script'){
  const fs=require('fs');
  const actions=JSON.parse(fs.readFileSync(args[2],'utf8'));
  const {eng}=boot();
  for(const a of actions){
    const r=eng.turn(a);
    console.log('['+fmt(r.clock)+'] '+a.type+' -> '+(r.action&&r.action.msg||'')+' | mission '+r.state+(r.compromised?' COMPROMISED':''));
  }
  console.log('\nFINAL VIEW:\n'+JSON.stringify(eng.playerView(),null,2));
}else if(cmd==='diag'){
  const {eng}=boot();
  console.log(JSON.stringify(eng.diagnostics(),null,2));
}
function fmt(s){const m=Math.floor(s/60)%60,h=Math.floor(s/3600);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
