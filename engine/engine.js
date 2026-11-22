// ============================================================================
// V3 ENGINE — turn resolver. Ties all modules together.
// Fixes from v2 review: event ledger (no re-fire), real time costs, player
// injury, aim sway in shots, heat escalation, graded success, body-blocking,
// dead-man trigger, mission states, observation ledger.
// ============================================================================
const path=require('path');
const {makeMap}=require('./map');
const P=require('./physics');
const {d100}=require('./rng');
const {makeLedger}=require('./ledger');
const {makeHeat}=require('./heat');
const {makeMission}=require('./missionstate');
const {decideAll}=require('./brain');

// ---------- graded outcomes ----------
function grade(entry){
  return entry.grade; // CRITICAL_SUCCESS | SUCCESS | FAIL | CRITICAL_FAIL
}

function makeEngine(cfg){
  const world=cfg.world;
  const map=makeMap(cfg.mapDef);
  const ledger=makeLedger(world.resolvedEvents||[]);
  const heat=makeHeat({decay:cfg.heatDecay||1,thresholds:[
    {at:12,event:'CHECKIN'},{at:40,event:'SWEEP'},{at:75,event:'LOCKDOWN'}]});
  if(world.heat)heat.load(world.heat);
  const mission=makeMission(world.missionDef||{});
  if(world.missionState)mission.load(world.missionState);

  const env={
    ambientDb:cfg.ambientDb!=null?cfg.ambientDb:32,
    rain:!!cfg.rain,
    breaker:world.breaker||'on',
    ambientLight:cfg.mapDef.ambient||1
  };
  const lights=cfg.mapDef.lights||[];

  // ---------- helpers ----------
  function norm(c){return map.normalize?map.normalize(c):(String(c).indexOf('-')>=0?c:(world.level||'L0')+'-'+c)}
  function room(c){return map.roomName?map.roomName(norm(c)):c}
  function player(){return world.player}
  function npc(id){return world.npcs.find(n=>n.id===id)}
  function alive(id){const n=npc(id);return !!n&&n.alive!==false}
  function openDoors(){const s=new Set();for(const k in map.doors)if(map.doors[k]==='open')s.add(k);return s}
  function posOf(id){return (world.positions&&world.positions[id])||{}}

  // ---------- observation ledger: what the player has actually seen ----------
  function observe(cell,what,t){
    world.observations=world.observations||[];
    world.observations.push({cell:norm(cell),what,t:world.clock});
  }

  // ---------- action costs ----------
  function applyCost(a){
    const t=Number(a.timeCost)||0;
    world.clock+=t;
    if(a.noise){
      world.sounds.push({id:a.id||('ACT-'+world.clock),cell:norm(a.cell||player().cell),db:a.noise,
        time:world.clock,type:a.type||'action',desc:a.desc||'action'});
      heat.add(norm(a.cell||player().cell),a.noise>60?18:a.noise>45?8:2,a.desc||'action');
    }
    if(a.heat)heat.add(norm(a.cell||player().cell),a.heat,a.desc||'action');
  }

  // ---------- hearing / sight projection ----------
  function audibility(listener,snd){
    return P.audible(map,norm(listener),snd,env,openDoors());
  }
  function sightOf(n,p){
    const nc=norm(posOf(n.id).cell||n.cell),pc=norm(p.cell);
    const nl=nc.slice(0,2),pl=pc.slice(0,2);
    if(nl!==pl)return{seen:false};
    const dcells=map.dist(nc,pc);
    const light=P.lightAt(map,pc,lights,env);
    if(dcells===0){
      const r=d100('same-cell '+n.id,light>=0.4?95:75);
      return{seen:r.success,entry:r,grade:grade(r)};
    }
    if(dcells*4>(n.range||22))return{seen:false};
    if(!map.los(nc,pc,{openDoors:openDoors()}).clear)return{seen:false};
    const posture={standing:1,crouched:0.6,prone:0.3}[p.posture]||1;
    const moved=(world.clock-(p.movedAt||0)<6)?1.4:0.7;
    const dark=p.darkness!=null?p.darkness:0.8;
    const wounds=(p.wounds||[]).length;
    const score=light*posture*moved*dark*Math.max(0.3,1-dcells/12)*(1-wounds*0.08);
    const r=d100('sight '+n.id+' -> player',Math.min(95,Math.round(score*60)));
    return{seen:r.success,entry:r,grade:grade(r)};
  }

  // ---------- belief generation (per NPC, restricted) ----------
  function projectBeliefs(){
    const B={};
    for(const n of world.npcs){
      const cell=norm(posOf(n.id).cell||n.cell);
      const b={id:n.id,role:n.role,cell,seesPlayer:null,heard:[],evidence:[],told:[],
        suspicion:0,noiseRead:null,gunshotHeard:false};
      for(const s of world.sounds){
        if(s.time>world.clock)continue;
        const a=audibility(cell,s);
        if(a.heard)b.heard.push({soundId:s.id,type:s.type,desc:s.desc,at:s.time,
          believedCell:P.localize(n.id,s,a,map),level:a.level,margin:a.margin,gunshot:!!s.gunshot});
      }
      const s=sightOf(n,player());
      if(s.seen){
        b.seesPlayer={cell:player().cell,at:world.clock};
        observe(player().cell,n.name+' spotted you');
      }
      for(const e of world.evidence||[]){
        if(norm(e.cell)===cell)b.evidence.push({id:e.id,desc:e.desc,at:e.time});
      }
      for(const m of world.messages||[]){
        if((m.to===n.id||m.to==='all')&&m.time<=world.clock){
          b.told.push({from:m.from,text:m.text,content:m.content,at:m.time,confidence:m.confidence});
          if(m.content&&m.content.reframe)b.noiseRead=m.text;
          if(m.content&&m.content.playerCell)b.reportedPlayer=m.content.playerCell;
        }
      }
      if(b.heard.some(h=>h.gunshot))b.gunshotHeard=true;
      B[n.id]=b;
    }
    return B;
  }

  let pendingGunshot=false;

  // ---------- brain + movement ----------
  function thinkAndMove(B){
    const {decisions,trace}=decideAll(world,B,world.positions,map,d100module,heat);
    world.brainTrace=trace;
    const newPos={};
    for(const n of world.npcs){
      const d=decisions[n.id]||{};
      if(n.alive===false){newPos[n.id]={cell:norm(posOf(n.id).cell||n.cell),mode:'down'};continue}
      const cur=norm(posOf(n.id).cell||n.cell);
      let cell=cur;
      const target=d.target?norm(d.target):null;
      const movedAt=posOf(n.id).movedAt||0;
      if(target&&target!==cell&&d.mode!=='patrol'&&world.clock-movedAt>=3+(d.delay||0)){
        const pth=map.path(cell,target,{});
        if(pth&&pth.length>1)cell=pth[1];
      } else if(d.mode==='patrol'&&n.patrol&&n.patrol.length&&world.clock-movedAt>=3){
        const seg=Math.floor(world.clock/12)%n.patrol.length;
        cell=norm(n.patrol[seg]);
      }
      if(cell!==cur){
        const et=map.edgeType(cur,cell),dk=[cur,cell].sort().join('|');
        if(et==='door'){
          const prev=map.doors[dk]||'closed';
          map.setDoor(dk,'open');
          const r=d100(n.id+' close door behind',(n.traits||{}).discipline||60);
          if(r.success)map.setDoor(dk,prev==='locked'?'locked':'closed');
          world.movementLog.push(world.clock+' | '+n.id+' door '+dk+' '+(r.success?'closed':'left open'));
        }
        const mat=map.material(cell);
        const db=42+(P.MATERIAL[mat]||0);
        world.sounds.push({id:'STEP-'+n.id+'-'+world.clock,cell:cell,db:db,time:world.clock,
          type:'footstep',desc:n.name+' footsteps on '+mat});
        heat.add(cell,2,n.name+' movement');
        world.movementLog.push(world.clock+' | '+n.id+' '+cur+' -> '+cell+' '+db+'dB');
      }
      newPos[n.id]={cell:cell,mode:d.mode||'patrol',target:target||null,movedAt:cell!==cur?world.clock:movedAt,facing:d.facing||n.facing};
    }
    world.positions=newPos;
    return decisions;
  }

  const d100module={d100:(label,target)=>d100(label,target)};

  // ---------- player actions ----------
  const actions={
    move(a){
      let to=norm(a.cell||a.to);
      const from=norm(player().cell);
      if(!map.cells[to])return{ok:false,msg:'No such cell'};
      const pth=map.path(from,to,{});
      if(!pth||pth.length<2)return{ok:false,msg:'No path'};
      const steps=pth.length-1;
      const mat=map.material(to);
      applyCost({id:'MOVE',cell:to,timeCost:steps*3,noise:steps>1?46:38+(P.MATERIAL[mat]||0),
        desc:'moving through '+room(to)});
      player().cell=to;
      player().movedAt=world.clock;
      observe(to,'you entered '+room(to));
      checkObjectives(mission,world);
      const exitCells=[world.exit&&world.exit.cell,...world.objectives.filter(o=>o.type==='extract').map(o=>o.target)].filter(Boolean).map(norm);
      if(exitCells.includes(to)&&mission.state==='EXTRACTION')mission.advance('COMPLETE');
      return{ok:true,msg:'Moved to '+room(to)};
    },
    crouch(){player().posture='crouched';applyCost({id:'CROUCH',timeCost:1});return{ok:true}},
    stand(){player().posture='standing';applyCost({id:'STAND',timeCost:1});return{ok:true}},
    openDoor(a){
      let key=a.key||a.cell||a.door;const quiet=!!a.quiet;
      key=(String(key).indexOf('|')>=0)?key:[norm(player().cell),norm(key)].sort().join('|');
      if(map.edgeType(key.split('|')[0],key.split('|')[1])!=='door')return{ok:false,msg:'Not a door'};
      const r=d100('open door '+key,quiet?78:92);
      if(r.grade==='CRITICAL_FAIL')return{ok:false,msg:'Door jammed',grade:r.grade};
      map.setDoor(key,'open');
      applyCost({id:'DOOR',cell:key.split('|')[0],timeCost:quiet?4:2,
        noise:quiet?30:48,desc:'door opened'});
      return{ok:true,grade:r.grade,msg:'Door open'};
    },
    closeDoor(a){let key=a.key||a.cell||a.door;key=(String(key).indexOf('|')>=0)?key:[norm(player().cell),norm(key)].sort().join('|');
      map.setDoor(key,'closed');applyCost({id:'DOOR',cell:key.split('|')[0],timeCost:2,noise:34,desc:'door closed'});return{ok:true}},
    wedge(a){
      let key=a.key||a.cell||a.door;
      key=(String(key).indexOf('|')>=0)?key:[norm(player().cell),norm(key)].sort().join('|');
      const r=d100('wedge '+key,80);
      if(r.success){world.wedged=world.wedged||[];world.wedged.push(key);
        applyCost({id:'WEDGE',timeCost:3,noise:30,desc:'wedge placed'});
        return{ok:true,grade:r.grade,msg:'Wedged'};}
      world.sounds.push({id:'WEDGE-FAIL',cell:key.split('|')[0],db:42,time:world.clock,type:'metal',desc:'wedge clatter'});
      applyCost({id:'WEDGE',timeCost:3});
      return{ok:false,grade:r.grade,msg:'Wedge slipped'};
    },
    shoot(a){
      const target=a.target||a.id,aim=a.aim||'center';
      if(!player().gun)return{ok:false,msg:'No weapon ready'};
      if(player().ammo<=0)return{ok:false,msg:'Out of ammo'};
      const t=npc(target);
      if(!t||t.alive===false)return{ok:false,msg:'No target'};
      const from=norm(player().cell),to=norm(posOf(target).cell||t.cell);
      const pathCells=map.path(from,to,{})||[from,to];
      let hit=null;
      for(let i=1;i<pathCells.length;i++){
        const occ=world.npcs.filter(n=>n.alive!==false&&norm(posOf(n.id).cell||n.cell)===pathCells[i]);
        if(occ.length){hit=occ[0];break}
      }
      // aim sway actually affects the roll
      const sway=player().sway||0.14;
      const aimBonus=aim==='head'?18:aim==='leg'?-10:0;
      const coverBonus=(player().cover?-12:0);
      const targetNum=Math.max(5,Math.min(95,72+aimBonus+coverBonus-Math.round(sway*90)));
      const r=d100('shoot '+target+' ('+aim+')',targetNum);
      applyCost({id:'SHOT',cell:from,timeCost:2,noise:62,desc:'suppressed pistol'});
      world.sounds[world.sounds.length-1].gunshot=true;
      player().ammo--;
      pendingGunshot=true;
      if(!r.success)return{ok:true,grade:r.grade,hit:null,msg:'Missed'};
      if(!hit)hit=t;
      hit.alive=false;
      world.kills=(world.kills||0)+1;
      world.evidence.push({id:'BODY-'+hit.id,type:'body',cell:norm(posOf(hit.id).cell||hit.cell),time:world.clock,desc:'body of '+hit.name});
      world.evidence.push({id:'BLOOD-'+hit.id,type:'blood',cell:norm(posOf(hit.id).cell||hit.cell),time:world.clock,desc:'blood'});
      heat.add(norm(posOf(hit.id).cell||hit.cell),12,'body');
      // objective check
      for(const o of world.objectives||[]){
        if(o.type==='eliminate'&&o.target===hit.id)o.done=true;
      }
      checkObjectives(mission,world);
      return{ok:true,grade:r.grade,hit:hit.id,blocked:hit.id!==target,msg:hit.id===target?'Target hit':'Blocked by '+hit.name};
    },
    copy(a){
      let cell=norm(a.cell||a.target||player().cell);
      if(map.dist(norm(player().cell),cell)>0)return{ok:false,msg:'Not in the cell'};
      const r=d100('copy data',75);
      applyCost({id:'COPY',cell:cell,timeCost:6,noise:34,desc:'data transfer'});
      if(r.success){for(const o of world.objectives||[])if(o.type==='copy'&&norm(o.target)===cell)o.done=true;
        checkObjectives(mission,world);return{ok:true,grade:r.grade,msg:'Copied'}}
      return{ok:false,grade:r.grade,msg:'Copy failed'};
    },
    deactivate(a){
      let cell=norm(a.cell||a.target||player().cell);
      if(map.dist(norm(player().cell),cell)>0)return{ok:false,msg:'Not in the cell'};
      const r=d100('deactivate kill switch',world.decoder?85:55);
      applyCost({id:'DEACT',cell:cell,timeCost:8,noise:38,desc:'kill switch'});
      if(r.success){world.triggerDisarmed=true;
        for(const o of world.objectives||[])if(o.type==='deactivate')o.done=true;
        checkObjectives(mission,world);return{ok:true,grade:r.grade,msg:'Disarmed'}}
      return{ok:false,grade:r.grade,msg:'Failed'};
    },
    search(a){
      const id=a.id||a.target;
      const n=npc(id);
      if(!n||n.alive!==false)return{ok:false,msg:'No body'};
      const cell=norm(posOf(id).cell||n.cell);
      if(map.dist(norm(player().cell),cell)>0)return{ok:false,msg:'Not at body'};
      const items=(n.carried||[]).slice();
      n.carried=[];
      for(const it of items)if(!player().gear.includes(it))player().gear.push(it);
      applyCost({id:'SEARCH',cell:cell,timeCost:5,noise:30,desc:'searching body'});
      return{ok:true,msg:'Took: '+items.map(i=>i).join(', ')};
    },
    drag(a){
      const id=a.id||a.target,to=a.to||a.cell;
      const n=npc(id);if(!n||n.alive!==false)return{ok:false,msg:'No body'};
      const cell=norm(posOf(id).cell||n.cell),dest=norm(to);
      if(map.dist(norm(player().cell),cell)>0)return{ok:false,msg:'Not at body'};
      if(!map.cells[dest])return{ok:false,msg:'No such cell'};
      const d=map.dist(cell,dest),secs=Math.round(d*4);
      world.evidence.push({id:'TRAIL-'+id+'-'+world.clock,type:'trail',cell:cell,time:world.clock,desc:'blood trail'});
      applyCost({id:'DRAG',cell:cell,timeCost:secs,noise:55,desc:'dragging body'});
      n.cell=dest;world.positions[id]={cell:dest,mode:'down'};
      return{ok:true,msg:'Body moved to '+room(dest)};
    },
    radio(a){
      const text=a.text||a.msg||'',channel=a.channel;
      applyCost({id:'RADIO',timeCost:2,noise:0,desc:'radio'});
      world.messages.push({from:'PLAYER',to:'all',channel:channel||world.radioChannel||'SEC',
        text:text,content:{},time:world.clock,confidence:0.8});
      return{ok:true,msg:'Transmitted'};
    },
    extract(a){
      const cell=norm(a.cell||player().cell);
      if(cell!==norm(player().cell))return{ok:false,msg:'Not at extraction point'};
      for(const o of world.objectives||[])if(o.type==='extract'&&cell===norm(o.target))o.done=true;
      applyCost({id:'EXTRACT',cell:cell,timeCost:2,desc:'extracting'});
      checkObjectives(mission,world);
      const exits=[world.exit&&world.exit.cell,...world.objectives.filter(o=>o.type==='extract').map(o=>o.target)].filter(Boolean).map(norm);
      if(exits.includes(cell)&&mission.state==='EXTRACTION')mission.advance('COMPLETE');
      return{ok:true,msg:'Extracted'};
    },
    wait(a){const s=Number(a&&a.seconds)||6;applyCost({id:'WAIT',timeCost:s,noise:a&&a.noise,desc:a&&a.desc||'waiting'});return{ok:true}}
  };

  function checkObjectives(m,o){
    const ms=m||mission;
    if(!world.objectives.every(x=>x.done))return;
    if(ms.state!=='EXTRACTION'&&ms.state!=='COMPLETE')ms.advance('OBJECTIVE_DONE');
    world.objectivesDone=true;
  }

  // ---------- turn ----------
  function turn(action){
    world.movementLog=world.movementLog||[];
    world.sounds=world.sounds||[];
    world.messages=world.messages||[];
    world.evidence=world.evidence||[];
    world.observations=world.observations||[];
    pendingGunshot=false;
    if(mission.state==='BRIEFING')mission.advance('START');
    if(mission.state==='INFILTRATION')mission.advance('ENTER');
    const res=action&&actions[action.type]?actions[action.type](action):{ok:false,msg:'No action'};
    // heat decay & threshold events
    const heatEvents=heat.tick();
    for(const e of heatEvents){
      world.messages.push({from:'SYSTEM',to:'all',text:e.event+' — heat '+Math.round(e.level||heat.global()),
        content:{},time:world.clock,confidence:1});
      ledger.resolveOnce('heat-'+e.event+'-'+world.clock,()=>{
        if(e.event==='LOCKDOWN')world.lockdown=true;
        return e;
      });
    }
    // project perception -> beliefs -> brain -> movement
    const B=projectBeliefs();
    world.beliefs=B;
    thinkAndMove(B);
    // hostile fire: an alert guard with sight of the player shoots
    const pNow=player();
    for(const n of world.npcs){
      if(n.alive===false||!B[n.id])continue;
      const d=B[n.id];
      const sees=d.seesPlayer;
      const hostile=(d.gunshotHeard||d.suspicion>=2||(d.told||[]).some(t=>t.content&&t.content.playerCell));
      if(!sees||!hostile)continue;
      const cell=norm(posOf(n.id).cell||n.cell);
      if(!map.los(cell,norm(pNow.cell),{openDoors:openDoors()}).clear)continue;
      const r=d100(n.id+' fires at player',45-(pNow.posture==='crouched'?10:0));
      if(r.success){
        const dmg=12+((n.weapon==='rifle'||n.weapon==='SMG')?8:0);
        pNow.hp-=dmg;
        (pNow.wounds=pNow.wounds||[]).push(n.name+' gunshot ('+dmg+' hp)');
        pNow.sway=Math.min(0.5,(pNow.sway||0.14)+0.06);
        world.messages.push({from:n.id,to:'SYSTEM',text:'HIT PLAYER -'+dmg,content:{},time:world.clock,confidence:1});
        if(pNow.hp<=0){world.compromised=true;mission.advance('FAIL')}
      }
    }
    // dead-man trigger: if target died and switch not disarmed, schedule transmission
    const targetMissionTarget=(world.objectives||[]).find(o=>o.type==='eliminate');
    if(targetMissionTarget&&world.deadman&&!world.triggerDisarmed){
      const dead=world.npcs.find(n=>n.id===targetMissionTarget.target);
      if(dead&&dead.alive===false&&!world.triggerArmedAt){world.triggerArmedAt=world.clock+90}
    }
    if(world.triggerArmedAt&&world.clock>=world.triggerArmedAt&&!world.triggerFired){
      const fired=ledger.resolveOnce('deadman-trigger',()=>true);
      if(fired.fired){
        world.triggerFired=true;world.compromised=true;
        mission.advance('FAIL');
        world.messages.push({from:'SYSTEM',to:'all',text:'DEAD-MAN TRIGGER — file transmitted',content:{},time:world.clock,confidence:1});
      }
    }
    if(world.clock>=world.deadline&&!world.compromised){world.compromised=true;mission.advance('FAIL')}
    world.heat=heat.dump();
    world.missionState=mission.dump();
    world.resolvedEvents=ledger.dump();
    return{action:res,heatEvents,state:mission.state,compromised:!!world.compromised,clock:world.clock};
  }

  function playerView(){
    const p=player();
    const cell=norm(p.cell);
    const visible=new Set([cell]);
    for(const id in map.cells){
      const f=map.level(id)===(cell.slice(0,2))?cell.slice(0,2)+'-'+id:id;
      if(map.level(id)!==cell.slice(0,2))continue;
      if(map.dist(cell,f)<=8&&map.los(cell,f,{openDoors:openDoors()}).clear&&P.lightAt(map,f,lights,env)>=0.8)visible.add(f);
    }
    const heard=world.sounds.filter(s=>world.clock-s.time<=6).filter(s=>audibility(cell,s).heard)
      .map(s=>({desc:s.desc,at:s.time,cell:P.localize('PLAYER',s,audibility(cell,s),map),db:s.level||s.db}));
    const contacts=world.npcs.filter(n=>n.alive!==false&&visible.has(norm(posOf(n.id).cell||n.cell)))
      .map(n=>({id:n.id,name:n.name,role:n.role,cell:norm(posOf(n.id).cell||n.cell)}));
    return{clock:world.clock,mission:mission.state,you:{cell:cell,room:room(cell),posture:p.posture,hp:p.hp,
      wounds:p.wounds||[],ammo:p.ammo,gear:p.gear||[]},
      visible:[...visible],contacts,heard,heat:heat.global(),
      observations:world.observations.slice(-20),objectives:world.objectives.map(o=>({desc:o.desc,done:!!o.done})),
      light:P.lightAt(map,cell,lights,env),material:map.material(cell),
      exposure:(p.wounds||[]).length>0?'WOUNDED':'OK'};
  }

  // overlay data for the GUI — derived from world, filtered to player perception
  function overlays(){
    const lm={};
    for(const f in map.cells){lm[f]=P.lightAt(map,f,lights,env)}
    const sounds=(world.sounds||[]).filter(s=>world.clock-s.time<=12).map(s=>({
      cell:s.cell,db:s.db,type:s.type,desc:s.desc,at:s.time,
      heard:!!audibility(player().cell,s).heard}));
    const seen=new Set([norm(player().cell)]);
    for(const f in map.cells){
      if(map.los(player().cell,f,{openDoors:openDoors()}).clear&&lm[f]>=0.8)seen.add(f)}
    const cams=(mission.cameras||[]).map(c=>({
      id:c.id,cell:'L0-'+String(c.cell).replace('L0-',''),facing:c.facing,fov:c.fov,range:c.range,ir:!!c.ir,
      visible:seen.has('L0-'+String(c.cell).replace('L0-',''))}));
    const cones=world.npcs.filter(n=>n.alive!==false&&seen.has(norm(posOf(n.id).cell||n.cell)))
      .map(n=>({id:n.id,cell:norm(posOf(n.id).cell||n.cell),facing:(world.positions[n.id]||{}).facing||n.facing,
        range:n.range||20}));
    return{lightmap:lm,sounds:sounds,cameras:cams,guardCones:cones,visible:[...seen]};
  }
  function diagnostics(){return{heat:heat.status(),beliefs:world.beliefs||{},brainTrace:world.brainTrace||'',
    positions:world.positions,audit:(function(){try{return require('fs').readFileSync(path.join(__dirname,'..','audit.log'),'utf8').trim().split('\n').slice(-20)}catch(e){return []}})(),
    movement:world.movementLog||[],trigger:{armed:world.triggerArmedAt||null,fired:!!world.triggerFired,disarmed:!!world.triggerDisarmed}};}

  return{turn,actions:Object.keys(actions),playerView,diagnostics,overlays,world,map,heat,mission,ledger,
    save(){return JSON.stringify({world,mapDoors:map.doors})},
    load(json){const d=JSON.parse(json);Object.assign(world,d.world);for(const k in d.mapDoors)map.setDoor(k,d.mapDoors[k]);}
  };
}

module.exports={makeEngine};
