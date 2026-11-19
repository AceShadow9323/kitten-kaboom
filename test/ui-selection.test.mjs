import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {html} from '../game/ui.mjs';
const PLAYER='11111111-1111-4111-8111-111111111111';
function selection(hand,mode='party',navigation={}) {
  const nodes=new Map(),timers=[];
  const make=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v},insertAdjacentHTML(_,v){this.innerHTML+=v}});return nodes.get(s)};
  const cards=hand.map((_,i)=>({dataset:{index:String(i)},setAttribute(k,v){this[k]=v},closest(){return {classList:{toggle(){}}}}}));
  const modes=()=>[...make('#selection').innerHTML.matchAll(/data-combo-count="(\d)"/g)].map(m=>{const b=make('mode-'+m[1]);b.dataset={comboCount:m[1]};return b});
  const context=vm.createContext({crypto:{randomUUID},document:{body:{classList:{add(){},remove(){}}},querySelector:make,querySelectorAll:s=>s==='.table-hand .card'?cards:s==='[data-combo-count]'?modes():s==='[data-edition]'?['original','party'].map(edition=>{const b=make('edition-'+edition);b.dataset={edition};return b}):[]},sessionStorage:{getItem:k=>k==='kk-id'?PLAYER:null,setItem(){}},localStorage:{getItem:()=>null,setItem(){}},location:{origin:'https://example.test',pathname:navigation.pathname??'/',search:navigation.search??''},URLSearchParams,setInterval(){},setTimeout(fn,ms){timers.push({fn,ms})},requestAnimationFrame(){},innerWidth:1200,innerHeight:900});
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

test('live card events skip history on refresh, deduplicate polling and start fresh for a rematch',()=>{
  const s=selection(['skip']),run=expression=>JSON.parse(vm.runInContext('JSON.stringify('+expression+')',s.context));vm.runInContext('cardEffectSnapshot=null',s.context);
  const first={code:'ROOM01',roundId:'r1',phase:'playing',effects:[{id:'e1',seq:1,type:'nope',actor:PLAYER}]};assert.deepEqual(run('freshCardEffects('+JSON.stringify(first)+')'),[]);
  const next={...first,effects:[...first.effects,{id:'e2',seq:2,type:'shuffle',actor:PLAYER}]};assert.equal(run('freshCardEffects('+JSON.stringify(next)+')')[0].id,'e2');assert.deepEqual(run('freshCardEffects('+JSON.stringify(next)+')'),[]);assert.deepEqual(run('freshCardEffects('+JSON.stringify(first)+')'),[]);assert.deepEqual(run('freshCardEffects('+JSON.stringify(next)+')'),[]);
  run('freshCardEffects('+JSON.stringify({...next,phase:'lobby'})+')');assert.equal(run('freshCardEffects('+JSON.stringify({...first,roundId:'r2'})+')')[0].id,'e1');
});
test('card effects survive polling and sequence bottom draw before explosion without duplicate legacy playback',()=>{
  const s=selection(['skip']);vm.runInContext("room.effects=[];last='';render();room.effects=[{id:'e1',seq:1,type:'bottom',actor:id},{id:'e2',seq:2,type:'explosion',actor:'player-1'}];room.explosions=[{id:'legacy',player:'player-1'}];room.players[1].alive=false;room.rev=1;last='';render()",s.context);
  const frame=s.node('#cardFxMount').innerHTML;assert.ok(frame.includes('bottom-card'));assert.ok(frame.includes('DRAW FROM BOTTOM'));assert.equal(s.timers[0].ms,3300);assert.equal(s.node('#explosionMount').innerHTML,'');
  vm.runInContext('room.rev++;render()',s.context);assert.equal(s.node('#cardFxMount').innerHTML,frame);assert.equal(s.timers.length,1);
  s.timers[0].fn();assert.equal(s.node('#cardFxMount').innerHTML,'');assert.ok(s.node('#explosionMount').innerHTML.includes('KABOOM!'));assert.equal(s.timers.length,2);s.timers[1].fn();assert.equal(s.timers.length,2);assert.equal(s.node('#explosionMount').innerHTML,'');
});
test('Favor uses actual giver and requester avatar coordinates rather than fixed preview seats',()=>{
  const s=selection(['skip']);s.node('.game-stage').getBoundingClientRect=()=>({left:100,top:100,width:1000,height:500});s.node('[data-seat="'+PLAYER+'"] .seat-avatar').getBoundingClientRect=()=>({left:580,top:510,width:40,height:40});s.node('[data-seat="player-1"] .seat-avatar').getBoundingClientRect=()=>({left:180,top:210,width:40,height:40});
  vm.runInContext("room.effects=[];last='';render();room.effects=[{id:'e1',seq:1,type:'favor',actor:id,target:'player-1'}];room.rev=1;last='';render()",s.context);
  const frame=s.node('#cardFxMount').innerHTML;assert.ok(frame.includes('favor-heart'));assert.ok(frame.includes('--giver-x:10%'));assert.ok(frame.includes('--giver-y:26%'));assert.ok(frame.includes('--recipient-x:50%'));assert.ok(frame.includes('--recipient-y:86%'));assert.ok(!frame.includes('/art/skip.jpg'));assert.equal(s.timers[0].ms,3000);
});
test('leaving the round cancels running card effects; reduced motion uses a short static effect',()=>{
  const s=selection(['skip']);vm.runInContext("globalThis.matchMedia=()=>({matches:true});room.effects=[];last='';render();room.effects=[{id:'e1',seq:1,type:'peek',actor:id}];room.rev=1;last='';render()",s.context);assert.ok(s.node('#cardFxMount').innerHTML.includes('crystal-art'));assert.ok(s.node('#cardFxMount').innerHTML.includes('playing reduced'));assert.equal(s.timers[0].ms,1000);
  vm.runInContext("room.phase='lobby';room.rev++;render()",s.context);assert.equal(s.node('#cardFxMount').innerHTML,'');s.timers[0].fn();assert.equal(s.node('#cardFxMount').innerHTML,'');
});

test('slow state responses cannot roll back a newer game revision or replay its animations',async()=>{
  const s=selection(['skip']);vm.runInContext("room.rev=10;room.effects=[{id:'e2',seq:2,type:'shuffle',actor:id}];globalThis.fetch=async()=>({ok:true,json:async()=>({code:room.code,rev:9,effects:[]})})",s.context);
  const revision=await vm.runInContext("api('state?code='+room.code).then(state=>state.rev)",s.context);assert.equal(revision,10);
  const run=expr=>JSON.parse(vm.runInContext('JSON.stringify('+expr+')',s.context));vm.runInContext('cardEffectSnapshot=null',s.context);
  run('freshCardEffects('+JSON.stringify({code:'R1',roundId:'old',phase:'finished',rev:10,effects:[]})+')');const next={code:'R1',roundId:'new',phase:'playing',rev:12,effects:[{id:'e1',seq:1,type:'peek',actor:PLAYER}]};assert.equal(run('freshCardEffects('+JSON.stringify(next)+')').length,1);
  assert.deepEqual(run('freshCardEffects('+JSON.stringify({code:'R1',roundId:'old',phase:'finished',rev:11,effects:[]})+')'),[]);assert.deepEqual(run('freshCardEffects('+JSON.stringify(next)+')'),[]);
});

test('See the Future displays ordered card faces directly for its user, including short decks',()=>{
  const s=selection(['skip']);vm.runInContext("room.players[0].peek=['boom','defuse','nope'];last='';render()",s.context);let panel=s.node('#peekCards').innerHTML;
  assert.ok(panel.includes('SEE THE FUTURE · 仅你可见'));assert.equal((panel.match(/<img /g)||[]).length,3);assert.ok(panel.indexOf('/art/boom.jpg')<panel.indexOf('/art/defuse.jpg'));assert.ok(panel.indexOf('/art/defuse.jpg')<panel.indexOf('/art/nope.jpg'));assert.ok(panel.includes('1 · TOP · 下一张'));assert.ok(panel.includes('data-inspect="boom"'));assert.ok(panel.includes('继续出牌，或抽牌结束'));
  vm.runInContext("room.players[0].peek=['shuffle','skip'];last='';render()",s.context);panel=s.node('#peekCards').innerHTML;assert.equal((panel.match(/<img /g)||[]).length,2);assert.ok(!panel.includes('/art/nope.jpg'));
});
test('See the Future card faces are not rendered from another player private result',()=>{
  const s=selection(['skip']);vm.runInContext("room.players[1].peek=['boom','defuse','nope'];last='';render()",s.context);assert.equal(s.node('#peekCards').innerHTML,'');assert.ok(!s.node('#cardFxMount').innerHTML.includes('/art/boom.jpg'));
});

test('manual draw sends the snapshot draw key so a stale click cannot draw twice',async()=>{
  const s=selection(['skip']);let request;
  s.context.capture=body=>{request=JSON.parse(body)};
  vm.runInContext("room.drawKey='round:0:0:0:2';room.rev=10;globalThis.fetch=async(url,options)=>{capture(options.body);return {ok:true,json:async()=>room}}",s.context);
  await vm.runInContext("move('draw')",s.context);assert.equal(request.action,'draw');assert.equal(request.drawKey,'round:0:0:0:2');
});


test('ordinary state polling keeps selected cats and chosen target',async()=>{
 const s=selection(['tacocat','tacocat']);vm.runInContext('room.rev=5;render()',s.context);s.cards[0].onclick();s.node('#target').value='player-1';
 vm.runInContext("code=room.code;room.rev=5;globalThis.fetch=async()=>({ok:true,json:async()=>({...room,serverNow:Date.now()})})",s.context);
 await vm.runInContext('pollRoom()',s.context);
 assert.deepEqual(s.selected(),[0,1]);assert.equal(s.node('#target').value,'player-1');
});
test('late polls are ignored after leaving or switching rooms and overlapping polls are skipped',async()=>{
 const s=selection(['skip']);let resolve,requests=0;
 s.context.delayedFetch=()=>{requests++;return new Promise(r=>{resolve=r})};
 vm.runInContext('code=room.code;globalThis.fetch=delayedFetch',s.context);
 const pending=vm.runInContext('pollRoom()',s.context);await vm.runInContext('pollRoom()',s.context);assert.equal(requests,1);
 vm.runInContext("room=null;code='NEW234'",s.context);
 resolve({ok:true,json:async()=>({code:'ABC234',rev:20})});await pending;
 assert.equal(vm.runInContext('room',s.context),null);assert.equal(vm.runInContext('code',s.context),'NEW234');
});
test('refresh dealing leaves cards beyond the initial eight visible',()=>{
 const s=selection(Array(11).fill('skip')),cards=Array.from({length:11},()=>({style:{},isConnected:true,getBoundingClientRect:()=>({left:0,top:0,width:60,height:84}),animate:()=>({finished:Promise.resolve()})}));
 s.node('#deckDraw').getBoundingClientRect=()=>({left:0,top:0,width:60,height:84});s.node('#deckDraw').animate=()=>({});
 s.context.document.querySelectorAll=selector=>selector==='.table-hand .card'?cards:[];
 s.context.matchMedia=()=>({matches:false});
 vm.runInContext('animateTableCards({firstDeal:true,newCards:false,played:false,seated:[],oldCount:0})',s.context);
 assert.ok(cards.slice(8).every(c=>c.style.opacity!=='0'));
});

test('a stalled request aborts and releases the action busy flag',async()=>{
 const s=selection(['skip']);s.context.AbortController=AbortController;s.context.clearTimeout=()=>{};
 s.context.fetch=(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Timed out')),{once:true}));
 const pending=vm.runInContext("move('draw')",s.context);const timeout=s.timers.find(t=>t.ms===12000);assert.ok(timeout);timeout.fn();await pending;
 assert.equal(vm.runInContext('busy',s.context),false);assert.ok(s.node('#error').textContent);
});
test('temporary reconnect failures retain room identity and retry; missing rooms return to setup',async()=>{
 const s=selection(['skip']);
 vm.runInContext("code=room.code;room=null;globalThis.fetch=async()=>{throw Error('offline')}",s.context);
 await vm.runInContext('pollRoom()',s.context);assert.equal(vm.runInContext('code',s.context),'ABC234');
 vm.runInContext("globalThis.fetch=async()=>({ok:true,json:async()=>({code:'ABC234',host:id,phase:'lobby',players:[{id,name:'Me',ready:false}],log:[]})})",s.context);
 await vm.runInContext('pollRoom()',s.context);assert.equal(vm.runInContext('room.phase',s.context),'lobby');
 s.context.sessionStorage.removeItem=()=>{};
 vm.runInContext("globalThis.fetch=async()=>({ok:false,status:404,json:async()=>({error:'Room not found'})})",s.context);
 await vm.runInContext('pollRoom()',s.context);assert.equal(vm.runInContext('room',s.context),null);assert.equal(vm.runInContext('code',s.context),null);
});
