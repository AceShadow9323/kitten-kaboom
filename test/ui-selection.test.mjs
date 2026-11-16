import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {html} from '../game/ui.mjs';
const PLAYER='11111111-1111-4111-8111-111111111111';
function selection(hand,mode='party',navigation={}) {
  const nodes=new Map(),timers=[];
  const make=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v},insertAdjacentHTML(_,v){this.innerHTML+=v}});return nodes.get(s)};
  const cards=hand.map((_,i)=>({dataset:{index:String(i)},setAttribute(k,v){this[k]=v},closest(){return {classList:{toggle(){}}}}}));
  const modes=()=>[...make('#selection').innerHTML.matchAll(/data-combo-count="(\d)"/g)].map(m=>{const b=make('mode-'+m[1]);b.dataset={comboCount:m[1]};return b});
  const context=vm.createContext({document:{body:{classList:{add(){},remove(){}}},querySelector:make,querySelectorAll:s=>s==='.table-hand .card'?cards:s==='[data-combo-count]'?modes():s==='[data-edition]'?['original','party'].map(edition=>{const b=make('edition-'+edition);b.dataset={edition};return b}):[]},sessionStorage:{getItem:k=>k==='kk-id'?PLAYER:null,setItem(){}},localStorage:{getItem:()=>null,setItem(){}},location:{origin:'https://example.test',pathname:navigation.pathname??'/',search:navigation.search??''},URLSearchParams,setInterval(){},setTimeout(fn,ms){timers.push({fn,ms})},requestAnimationFrame(){},innerWidth:1200,innerHeight:900});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const room={code:'ABC234',host:PLAYER,mode,phase:'playing',turn:0,owed:1,remaining:30,discard:[],log:[],players:[{id:PLAYER,name:'Me',alive:true,count:hand.length,hand},{id:'player-1',name:'Friend',alive:true,count:5}]};
  vm.runInContext('room='+JSON.stringify(room)+';render()',context);
  return {context,cards,node:make,modes,timers,selected:()=>JSON.parse(vm.runInContext('JSON.stringify(selected)',context))};
}
test('duplicate action cards never show pair/triple controls in either mode',()=>{
  for(const mode of ['original','party'])for(const c of ['defuse','attack','favor','nope','shuffle','skip','peek','targeted','alter','bottom']){
    const s=selection([c,c,c],mode);s.cards[0].onclick();
    assert.deepEqual(s.selected(),[0],mode+' '+c);
    assert.equal(s.modes().length,0,mode+' '+c+' exposed combo controls');
    assert.ok(!s.node('#selection').innerHTML.includes('Pair ·'));
    assert.ok(!s.node('#selection').innerHTML.includes('Triple ·'));
  }
});
test('all matching cats retain automatic pairs and the triple selector',()=>{
  for(const c of ['tacocat','meloncat','potatocat','beardcat','rainbowcat']){
    const s=selection([c,c,c]);s.cards[0].onclick();assert.deepEqual(s.selected(),[0,1]);
    assert.equal(s.modes().length,2);s.node('mode-3').onclick();assert.deepEqual(s.selected(),[0,1,2]);
  }
});
test('Feral Cat cannot auto-match action cards but can complete a cat triple',()=>{
  const no=selection(['feral','attack','attack']);no.cards[0].onclick();assert.deepEqual(no.selected(),[0]);assert.equal(no.modes().length,0);
  const yes=selection(['feral','tacocat','tacocat']);yes.cards[0].onclick();assert.deepEqual(yes.selected(),[0,1]);yes.node('mode-3').onclick();assert.deepEqual(yes.selected(),[0,1,2]);
});

test('home has only the supplied logo and PLAY; setup page keeps edition-specific artwork',()=>{const s=selection(['skip']);vm.runInContext("room=null;location.pathname='/';location.search='';selectedMode='original';landing()",s.context);assert.ok(s.node('#app').innerHTML.includes('/art/launch.png'));assert.ok(s.node('#app').innerHTML.includes('id="playNow" href="/play"'));assert.ok(!s.node('#app').innerHTML.includes('id="editionPicker"'));assert.ok(!s.node('#app').innerHTML.includes('id="create"'));assert.ok(!s.node('#app').innerHTML.includes('id="join"'));vm.runInContext("location.pathname='/play';landing()",s.context);assert.ok(s.node('#app').innerHTML.includes('/art/originalbox.png'));assert.ok(s.node('#app').innerHTML.indexOf('id="editionPicker"')<s.node('#app').innerHTML.indexOf('id="create"'));assert.ok(s.node('#app').innerHTML.includes('<h2>Host</h2>'));assert.ok(s.node('#app').innerHTML.includes('<h2>Join Friend</h2>'));s.node('edition-party').onclick();assert.ok(s.node('#app').innerHTML.includes('/art/partybox.png'));s.node('edition-original').onclick();assert.ok(s.node('#app').innerHTML.includes('/art/originalbox.png'))});
test('both direct and legacy invitation URLs open setup with their room code',()=>{for(const pathname of ['/','/play']){const s=selection(['skip'],'party',{pathname,search:'?room=ABC234'});vm.runInContext("room=null;landing()",s.context);assert.ok(s.node('#app').innerHTML.includes('id="joinCode"'));assert.ok(s.node('#app').innerHTML.includes('value="ABC234"'));assert.ok(!s.node('#app').innerHTML.includes('id="playNow"'))}});
test('switching mode keeps typed host name, friend name and room code',()=>{const s=selection(['skip']);vm.runInContext("room=null;location.pathname='/play';location.search='';landing()",s.context);s.node('#hostName').value='Host Cat';s.node('#joinName').value='Guest Cat';s.node('#joinCode').value='ZX2345';s.node('edition-party').onclick();assert.ok(s.node('#app').innerHTML.includes('value="Host Cat"'));assert.ok(s.node('#app').innerHTML.includes('value="Guest Cat"'));assert.ok(s.node('#app').innerHTML.includes('value="ZX2345"'))});

test('selected portraits render on the table and lobby only lets you edit your own avatar',()=>{
  const s=selection(['skip']);
  vm.runInContext("room.players[0].avatar='owl';room.players[1].avatar='pizza';last='';render()",s.context);
  assert.ok(s.node('#app').innerHTML.includes('aria-label="Owl"'));
  assert.ok(s.node('#app').innerHTML.includes('aria-label="Pizza"'));
  vm.runInContext("room.phase='lobby';last='';render()",s.context);
  assert.equal((s.node('#app').innerHTML.match(/id="changeAvatar"/g)||[]).length,1);
  assert.equal(typeof s.node('#changeAvatar').onclick,'function');
});

test('setup hides avatar button; lobby retains avatar editor and timer setting',()=>{
  const s=selection(['skip']);vm.runInContext("room=null;location.pathname='/play';landing()",s.context);
  assert.ok(!s.node('#app').innerHTML.includes('Change avatar'));assert.ok(!s.node('#app').innerHTML.includes('id="chooseAvatar"'));
  vm.runInContext("room={code:'ABC234',host:id,phase:'lobby',turnSeconds:60,players:[{id,name:'Me',avatar:'owl',ready:false}],log:[]};last='';render()",s.context);
  assert.equal(typeof s.node('#changeAvatar').onclick,'function');assert.ok(s.node('#controls').innerHTML.includes('id="turnSeconds"'));assert.equal(typeof s.node('#turnSeconds').onchange,'function');
});
test('active avatar has one countdown ring and seconds badge, with no timer when disabled',()=>{
  const s=selection(['skip']);vm.runInContext("room.turnClock={actor:id,deadline:Date.now()+30000,seconds:30,paused:false};last='';render()",s.context);
  const markup=s.node('#app').innerHTML;
  assert.equal((markup.match(/class="clock-ring"/g)||[]).length,1);assert.equal((markup.match(/class="clock-badge"/g)||[]).length,1);assert.ok(markup.includes('pathLength="100"'));
  vm.runInContext("room.turnClock=null;last='';render()",s.context);assert.ok(!s.node('#app').innerHTML.includes('class="clock-ring"'));
});

test('discard history opens newest first only when enabled; bomb risk gauge follows its own setting',()=>{
  const s=selection(['skip']);let opened=0;s.node('#discardHistory').showModal=()=>opened++;
  vm.runInContext("room.discard=['attack','skip','nope'];room.discardCount=3;room.showDiscard=true;room.showBombRisk=true;room.bombRisk={percent:25,bombs:1,total:4};last='';render()",s.context);
  assert.ok(s.node('#app').innerHTML.includes('BOMB RISK · 炸弹风险'));assert.ok(s.node('#app').innerHTML.includes('25.0%'));assert.ok(s.node('#app').innerHTML.includes('DISCARD · 3 · VIEW'));
  s.node('#discardInspect').onclick();assert.equal(opened,1);const list=s.node('#discardCards').innerHTML;assert.ok(list.indexOf('/art/nope.jpg')<list.indexOf('/art/skip.jpg'));assert.ok(list.indexOf('/art/skip.jpg')<list.indexOf('/art/attack.jpg'));
  vm.runInContext("room.showDiscard=false;room.showBombRisk=false;room.bombRisk=null;last='';render();openDiscardHistory()",s.context);
  assert.equal(opened,1);assert.ok(!s.node('#app').innerHTML.includes('BOMB RISK · 炸弹风险'));assert.ok(!s.node('#app').innerHTML.includes('VIEW ↗'));
});
test('host can toggle both table options in lobby and guests see their status',()=>{
  const s=selection(['skip']);vm.runInContext("room.phase='lobby';room.showDiscard=true;room.showBombRisk=false;last='';render()",s.context);
  assert.ok(s.node('#controls').innerHTML.includes('id="showDiscard" checked'));assert.equal(typeof s.node('#showDiscard').onchange,'function');assert.equal(typeof s.node('#showBombRisk').onchange,'function');
  vm.runInContext("room.host='player-1';last='';render()",s.context);assert.ok(s.node('#controls').innerHTML.includes('弃牌记录：开启 · 炸弹风险：关闭'));assert.ok(!s.node('#controls').innerHTML.includes('id="showDiscard"'));
});

test('winner banner uses the surviving player avatar even when names are identical',()=>{
  const s=selection(['skip']);
  vm.runInContext("room.phase='finished';room.winner='Same name';room.players[0].name='Same name';room.players[0].alive=false;room.players[0].avatar='shark';room.players[1].name='Same name';room.players[1].alive=true;room.players[1].avatar='owl';last='';render()",s.context);
  const banner=s.node('#app').innerHTML.split('<div class="winner-table">')[1].split('<div class="game-notice"')[0];
  assert.ok(banner.includes('class="winner-avatar"'));assert.ok(banner.includes('aria-label="Owl"'));assert.ok(!banner.includes('aria-label="Shark"'));assert.ok(!banner.includes('class="trophy"'));assert.ok(banner.includes('Same name wins!'));
});

test('explosion snapshots skip old events on refresh, deduplicate polls and reset for a new round',()=>{
  const s=selection(['skip']);
  const evaluate=expression=>JSON.parse(vm.runInContext('JSON.stringify('+expression+')',s.context));
  vm.runInContext('explosionSnapshot=null',s.context);
  const first={code:'ROOM01',roundId:'r1',phase:'playing',explosions:[{id:'e1',player:PLAYER}]};
  assert.deepEqual(evaluate('freshExplosions('+JSON.stringify(first)+')'),[]);
  const next={...first,explosions:[...first.explosions,{id:'e2',player:'player-1'}]};
  assert.deepEqual(evaluate('freshExplosions('+JSON.stringify(next)+')'),[{id:'e2',player:'player-1'}]);assert.deepEqual(evaluate('freshExplosions('+JSON.stringify(next)+')'),[]);
  assert.deepEqual(evaluate('freshExplosions('+JSON.stringify({...next,code:'OTHER1'})+')'),[]);
  evaluate('freshExplosions('+JSON.stringify({code:'ROOM01',roundId:'r1',phase:'lobby',explosions:[]})+')');
  assert.deepEqual(evaluate('freshExplosions('+JSON.stringify({...first,roundId:'r2'})+')'),first.explosions);
});
test('game explosions use the eliminated avatar, survive polling, queue multiple events and clear on rematch',()=>{
  const s=selection(['skip']);vm.runInContext("room.players[1].avatar='owl';room.players[1].name='<Mittens>';room.players[1].alive=false;room.explosions=[{id:'e1',player:'player-1'}];room.rev=1;last='';render()",s.context);
  const effect=s.node('#explosionMount').innerHTML;assert.ok(effect.includes('game-explosion-burst'));assert.ok(effect.includes('aria-label="Owl"'));assert.ok(effect.includes('&lt;Mittens&gt; · 已出局'));assert.equal(s.timers.length,1);assert.equal(s.timers[0].ms,2900);
  vm.runInContext('room.rev++;render()',s.context);assert.equal(s.timers.length,1);assert.equal(s.node('#explosionMount').innerHTML,effect);
  vm.runInContext("room.players[0].avatar='dino';room.explosions.push({id:'e2',player:id});room.rev++;render()",s.context);assert.equal(s.timers.length,1);
  s.timers[0].fn();assert.equal(s.timers.length,2);assert.ok(s.node('#explosionMount').innerHTML.includes('aria-label="Dinosaur"'));
  vm.runInContext("room.phase='lobby';room.rev++;render()",s.context);assert.equal(s.node('#explosionMount').innerHTML,'');s.timers[1].fn();assert.equal(s.node('#explosionMount').innerHTML,'');
});
test('reduced motion shows a brief elimination message without explosion animation',()=>{
  const s=selection(['skip']);vm.runInContext("globalThis.matchMedia=()=>({matches:true});room.explosions=[{id:'e1',player:'player-1'}];room.rev=1;last='';render()",s.context);
  assert.ok(s.node('#explosionMount').innerHTML.includes('game-explosion-reduced'));assert.equal(s.timers[0].ms,700);assert.ok(s.node('#explosionStatus').textContent.includes('无法拆除'));
  s.timers[0].fn();assert.equal(s.node('#explosionMount').innerHTML,'');
});
