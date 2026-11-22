// Apply a purchase order to the live account and persist it to live.json.
// Usage: node buy.js '<BUY: ...>'  OR  node buy.js  (reads buy-order.txt)
const fs=require('fs'),path=require('path');
const {makeAccount}=require('./engine/account');
const {ITEMS}=require('./content/items');
const LIVE=path.join(__dirname,'live.json');

function load(){
  if(fs.existsSync(LIVE))return JSON.parse(fs.readFileSync(LIVE,'utf8'));
  return makeAccount().dump();
}
function parse(text){
  // "BUY: 2x gasmask ($720), ... — TOTAL $11,515"
  const out=[];
  const re=/(\d+)\s*x\s*([a-zA-Z0-9_]+)/g;let m;
  while((m=re.exec(text)))out.push({id:m[2],qty:Number(m[1])});
  return out;
}
const text=process.argv[2]||(fs.existsSync(path.join(__dirname,'buy-order.txt'))?fs.readFileSync(path.join(__dirname,'buy-order.txt'),'utf8'):'');
if(!text){console.log('No order given');process.exit(1)}
const data=load();
const acct=makeAccount(data);
let ok=true,bought=[];
for(const line of parse(text)){
  if(!ITEMS[line.id]){console.log('UNKNOWN ITEM:',line.id);ok=false;continue}
  const cost=ITEMS[line.id].cost*line.qty;
  if(!acct.canAfford(cost)){console.log('INSUFFICIENT CREDITS for',line.id,line.qty);ok=false;continue}
  for(let i=0;i<line.qty;i++)acct.buy(line.id,ITEMS);
  bought.push(line.qty+'x '+line.id+' ('+ITEMS[line.id].name+') -$'+cost);
}
if(ok){fs.writeFileSync(LIVE,JSON.stringify(acct.dump(),null,2));
  console.log('PURCHASE COMMITTED:');bought.forEach(function(b){console.log('  '+b)});
  console.log('remaining credits:',acct.credits);}
else{console.log('Purchase rolled back — nothing saved');process.exit(1)}
