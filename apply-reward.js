const fs=require('fs');
const a=require('./engine/account');
const live=JSON.parse(fs.readFileSync('live.json','utf8'));
const acct=a.makeAccount(live);
acct.applyResult({success:true,kills:0,credits:4500,rep:8});
acct.recordMission({id:'m1_manifest',result:'COMPLETE',kills:0,creditsEarned:4500});
fs.writeFileSync('live.json',JSON.stringify(acct.dump(),null,2));
console.log('rewards applied — credits:',acct.credits,'rep:',acct.reputation,'missions:',acct.missions.length);
