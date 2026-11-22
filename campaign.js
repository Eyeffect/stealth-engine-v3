// Campaign runner — plays missions in sequence, carrying the persistent account.
const {makeEngine}=require('./engine/engine');
const {makeWorld}=require('./engine/world');
const {makeAccount}=require('./engine/account');
const {CAMPAIGN}=require('./content/campaign');
const fs=require('fs'),path=require('path');
const SAVE=path.join(__dirname,'save.json');

function makeCampaign(data){
  const acct=makeAccount(data&&data.account);
  const state={account:acct,completed:[],current:0,
    unlocked:data&&Array.isArray(data.unlocked)?data.unlocked:[CAMPAIGN.missions[0].id]};
  function available(){return CAMPAIGN.missions.filter(m=>state.unlocked.includes(m.id))}
  function start(missionId){
    const m=CAMPAIGN.missions.find(x=>x.id===missionId);
    if(!m||!state.unlocked.includes(missionId))return{ok:false,msg:'Mission locked'};
    const {world,mapDef}=makeWorld(missionId,acct);
    const eng=makeEngine({world,mapDef,ambientDb:32,rain:false});
    return{ok:true,eng,world,mission:m};
  }
  function finish(missionId,eng,world,success){
    const m=CAMPAIGN.missions.find(x=>x.id===missionId);
    if(!m)return;
    const result=success?m.rewards||{}:{credits:0,reputation:-5};
    acct.applyResult({success,kills:world.kills||0,credits:result.credits||0,rep:result.reputation||0});
    acct.recordMission({id:missionId,result:success?'COMPLETE':'FAILED',kills:world.kills||0,
      creditsEarned:result.credits||0});
    if(success){
      state.completed.push(missionId);
      const idx=CAMPAIGN.missions.findIndex(x=>x.id===missionId);
      const next=CAMPAIGN.missions[idx+1];
      if(next&&!state.unlocked.includes(next.id))state.unlocked.push(next.id);
    }
  }
  function save(){fs.writeFileSync(SAVE,JSON.stringify({account:acct.dump(),completed:state.completed,
    unlocked:state.unlocked},null,2))}
  function load(){if(!fs.existsSync(SAVE))return false;const d=JSON.parse(fs.readFileSync(SAVE,'utf8'));
    acct.load(d.account);state.completed=d.completed||[];state.unlocked=d.unlocked||[CAMPAIGN.missions[0].id];return true}
  function status(){return{campaign:CAMPAIGN.title,story:CAMPAIGN.story,credits:acct.credits,
    reputation:acct.reputation,gear:acct.gear,completed:state.completed,available:available().map(m=>({id:m.id,name:m.name,brief:m.brief}))}}
  state.save=save;state.load=load;state.status=status;state.start=start;state.finish=finish;
  state.available=available;state.account=acct;
  return state;
}

if(require.main===module){
  const c=makeCampaign();
  if(process.argv[2]==='--new'){c.unlocked=[CAMPAIGN.missions[0].id];c.completed=[]}
  else c.load();
  console.log(JSON.stringify(c.status(),null,2));
  c.save();
}
module.exports={makeCampaign};
