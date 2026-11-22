// Audited d100. Every roll is written to audit.log with full context.
const fs=require('fs'),path=require('path');
const LOG=path.join(__dirname,'..','audit.log');

function d100(label,target,context){
  const roll=Math.floor(Math.random()*100)+1;
  const success=roll<=target;
  const margin=target-roll;
  const entry={
    ts:new Date().toISOString(),label,target,roll,margin,
    verdict:success?'SUCCESS':'FAILURE',
    grade:margin<=-20?'CRITICAL_FAIL':margin<0?'FAIL':margin<20?'SUCCESS':'CRITICAL_SUCCESS',
    context:context||null
  };
  fs.appendFileSync(LOG,JSON.stringify(entry)+'\n');
  return entry;
}
function jitter(label,spread){
  let h=0;for(let i=0;i<label.length;i++)h=(h*31+label.charCodeAt(i))|0;
  return (Math.abs(h)%(2*spread+1))-spread;
}
module.exports={d100,jitter};
