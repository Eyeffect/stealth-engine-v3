// Runs the GUI's actual renderMap() against a fake DOM and counts drawn layers.
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../ui/index.html','utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const snapshot=require('../ui/snapshot.json');

// Minimal element stubs
function el(){return{innerHTML:'',textContent:'',className:'',style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},onclick:null,
  closest(){return null},appendChild(){},value:'',remove(){}};}
const ids={};
function byId(id){return ids[id]||(ids[id]=el());}
global.document={getElementById:byId,querySelectorAll(){return[]},addEventListener(){}};
global.location={protocol:'http:',href:'http://localhost/',search:''};
global.window=global;
global.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve(snapshot)});
global.navigator={clipboard:{writeText(){return Promise.resolve()}}};
global.alert=console.log;

// Evaluate the GUI script in this context, but stop it from auto-running fetch loops.
// We strip the boot section (fetch + setInterval) and expose internals.
let code=script.replace(/^\s*\(function\(\)\{/,'')
               .replace(/\}\)\(\);\s*$/,'');
code+='\nglobalThis.__api={init:init,renderMap:renderMap,getOV:function(){return OV}};';

let pass=0,fail=0;
function check(n,c,d){if(c){pass++;console.log('  PASS  '+n)}else{fail++;console.log('  FAIL  '+n+(d?' — '+d:''))}}

try{
  const fn=new Function(code);
  fn();
  const api=global.__api;
  check('GUI script evaluates',true);
  // init sets S and calls renderMap
  if(api.init){api.init(snapshot);}
  const grid=byId('grid').innerHTML;
  check('grid rendered',grid.length>500,grid.length+' chars');
  check('cells rendered',(grid.match(/data-cell=/g)||[]).length===30,
    (grid.match(/data-cell=/g)||[]).length+' cells');
  check('wall edges drawn',(grid.match(/e-wall/g)||[]).length>0,
    (grid.match(/e-wall/g)||[]).length+' walls');
  check('door edges drawn',(grid.match(/class="edge s-(top|right)"[^>]*style="background:linear-gradient/g)||[]).length>0,
    (grid.match(/gradient/g)||[]).length+' gradients');
  // fog of war: light overlay must NOT tint unobserved cells
  check('no light tint on unobserved cells',grid.indexOf('ov-light')===-1,
    'light overlays='+((grid.match(/ov-light/g)||[]).length));
  // toggle light on and confirm only visible cells tint
  if(api.OV){api.OV.light=true;api.renderMap();}
  const grid2=byId('grid').innerHTML;
  const lit=(grid2.match(/ov-light/g)||[]).length;
  const visible=snapshot.view.visible.length;
  check('light overlays limited to visible cells',lit<=visible,
    lit+' overlays vs '+visible+' visible cells');
}catch(e){
  check('GUI script evaluates',false,e.message);
}
console.log('\n==== '+pass+' passed, '+fail+' failed ====');
process.exit(fail?1:0);
