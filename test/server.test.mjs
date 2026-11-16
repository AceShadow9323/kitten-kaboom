import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {MemoryStore} from '../server/storage.mjs';
async function setup(t) {
  const store = new MemoryStore();
  const app = createApp({store,rateLimit:false});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.closeAllConnections();app.close(resolve)}));
  const base = 'http://127.0.0.1:'+app.address().port;
  const call = async (path, token, body, extra={}) => {
    const res = await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:res.status, data:await res.json()};
  };
  return {store,base,call};
}
test('standalone HTML, art, health and API do not require ChatGPT or platform auth',async t=>{
  const {base,call}=await setup(t);
  const root=await fetch(base);assert.equal(root.status,200);const body=await root.text();assert.ok(body.includes('Party Pack'));assert.ok(!/signin-with-chatgpt|OAI-Sites-Authorization|chatgpt\.site/i.test(body));
  const art=await fetch(base+'/art/back.jpg');assert.equal(art.status,200);assert.equal(art.headers.get('content-type'),'image/jpeg');
  for(const key of ['originalbox','partybox','launch','avataranimals','avatarfood']){const image=await fetch(base+'/art/'+key+'.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');const bytes=new Uint8Array(await image.arrayBuffer());assert.equal(bytes[0],137);assert.equal(bytes[1],80)}
  for(const path of ['/play','/play/','/play?room=ABC234']){const page=await fetch(base+path);assert.equal(page.status,200);assert.ok(page.headers.get('content-type').startsWith('text/html'))}
  assert.equal((await call('/healthz')).data.ok,true);
  assert.equal((await call('/api/create',randomUUID(),{name:'Alice',mode:'party'})).status,200);
  assert.equal((await call('/api/create','bad',{name:'Bad'})).status,401);
  assert.equal((await call('/api/create',randomUUID(),{name:'Bad'},{origin:'https://other.example'})).status,403);
  assert.equal((await fetch(base+'/art/../../.env')).status,404);
});
test('rooms join, ready, start and keep player credentials and other hands private',async t=>{
  const {call}=await setup(t),a=randomUUID(),b=randomUUID(),outsider=randomUUID();
  const room=(await call('/api/create',a,{name:'Alice'})).data,code=room.code;
  assert.equal((await call('/api/state?code='+code,outsider)).status,403);
  const joined=(await call('/api/join',b,{name:'Bob',code})).data;
  assert.equal(joined.players.length,2);assert.ok(!JSON.stringify(joined).includes(a));
  for(const who of [a,b])assert.equal((await call('/api/move',who,{code,action:'ready'})).status,200);
  const state=(await call('/api/move',a,{code,action:'start'})).data;
  assert.equal(state.phase,'playing');assert.equal(state.players[0].hand.length,8);assert.equal(state.players[1].hand,undefined);
  assert.equal((await call('/api/move',b,{code,action:'draw'})).status,400);
});
test('concurrent joins and draws are serialized without exceeding capacity or taking two turns',async t=>{
  const {call,store}=await setup(t),a=randomUUID();
  const {code}=(await call('/api/create',a,{name:'Host'})).data;
  const joins=await Promise.all(Array.from({length:8},(_,i)=>call('/api/join',randomUUID(),{code,name:'Guest '+i})));
  assert.equal(joins.filter(r=>r.status===200).length,4);
  await store.withRoom(code,r=>{r.phase='playing';r.turn=0;r.owed=1;r.attacked=false;r.deck=['skip','skip','skip'];r.discard=[];r.players.forEach(p=>{p.alive=true;p.hand=[]});return {changed:true,reply:null}});
  const draws=await Promise.all([call('/api/move',a,{code,action:'draw'}),call('/api/move',a,{code,action:'draw'})]);
  assert.equal(draws.filter(r=>r.status===200).length,1);
  const state=(await call('/api/state?code='+code,a)).data;
  assert.equal(state.remaining,2);assert.equal(state.players[0].hand.length,1);assert.equal(state.turn,1);
});
test('Party Pack supports 10 players, bots and end-round vote through standalone HTTP',async t=>{
  const {call}=await setup(t),a=randomUUID(),b=randomUUID();
  const {code}=(await call('/api/create',a,{name:'Host',mode:'party'})).data;
  for(let i=0;i<8;i++)assert.equal((await call('/api/move',a,{code,action:'addbot'})).status,200);
  assert.equal((await call('/api/join',b,{code,name:'Friend'})).status,200);
  assert.equal((await call('/api/join',randomUUID(),{code,name:'Overflow'})).status,400);
  for(const who of [a,b])await call('/api/move',who,{code,action:'ready'});
  const started=(await call('/api/move',a,{code,action:'start'})).data;assert.equal(started.remaining,40);assert.equal(started.maxPlayers,10);
  const vote=(await call('/api/move',a,{code,action:'requestend'})).data.endVote;
  assert.equal((await call('/api/move',a,{code,action:'draw'})).status,400);
  const ended=(await call('/api/move',b,{code,action:'voteend',voteId:vote.id,agree:true})).data;
  assert.equal(ended.phase,'lobby');assert.equal(ended.mode,'party');
});
test('standalone bots make progress on state polling and invalid actions roll back',async t=>{
  const {call,store}=await setup(t),a=randomUUID();const {code}=(await call('/api/create',a,{name:'Host'})).data;
  await call('/api/move',a,{code,action:'addbot'});await call('/api/move',a,{code,action:'ready'});await call('/api/move',a,{code,action:'start'});
  await store.withRoom(code,r=>{r.turn=1;r.deck=['skip','skip'];r.players[1].hand=[];r.botAt=0;return {changed:true,reply:null}});
  const state=(await call('/api/state?code='+code,a)).data;assert.equal(state.turn,0);assert.equal(state.remaining,1);
  const before=state.rev;assert.equal((await call('/api/move',a,{code,action:'play',indices:[999]})).status,400);
  assert.equal((await call('/api/state?code='+code,a)).data.rev,before);
});

test('avatars sync to everyone, validate choices, and survive starting and returning to lobby',async t=>{
  const {call}=await setup(t),a=randomUUID(),b=randomUUID();
  assert.equal((await call('/api/create',a,{name:'Host',avatar:'<script>'})).status,400);
  const {code}= (await call('/api/create',a,{name:'Host',avatar:'owl'})).data;
  const joined=(await call('/api/join',b,{code,name:'Guest',avatar:'pizza'})).data;
  assert.deepEqual(joined.players.map(p=>p.avatar),['owl','pizza']);
  assert.equal((await call('/api/move',b,{code,action:'setavatar',avatar:'https://example.com/a.png'})).status,400);
  await call('/api/move',b,{code,action:'setavatar',target:joined.players[0].id,avatar:'dino'});
  assert.deepEqual((await call('/api/state?code='+code,a)).data.players.map(p=>p.avatar),['owl','dino']);
  for(const who of [a,b])await call('/api/move',who,{code,action:'ready'});
  const playing=(await call('/api/move',a,{code,action:'start'})).data;
  assert.deepEqual(playing.players.map(p=>p.avatar),['owl','dino']);
  assert.equal((await call('/api/move',a,{code,action:'setavatar',avatar:'bear'})).status,400);
  const vote=(await call('/api/move',a,{code,action:'requestend'})).data;
  const ended=(await call('/api/move',b,{code,action:'voteend',voteId:vote.endVote.id,agree:true})).data;
  assert.equal(ended.phase,'lobby');assert.deepEqual(ended.players.map(p=>p.avatar),['owl','dino']);
});

test('HTTP timer settings synchronize, only host edits, and a state poll enforces expiry',async t=>{
  const {call,store}=await setup(t),a=randomUUID(),b=randomUUID();
  const created=(await call('/api/create',a,{name:'Host'})).data,code=created.code;
  assert.equal(created.turnSeconds,30);await call('/api/join',b,{code,name:'Friend'});
  assert.equal((await call('/api/move',b,{code,action:'settings',turnSeconds:60})).status,400);
  assert.equal((await call('/api/move',a,{code,action:'settings',turnSeconds:45})).status,400);
  const settings=(await call('/api/move',a,{code,action:'settings',turnSeconds:60})).data;
  assert.equal(settings.turnSeconds,60);for(const who of [a,b])await call('/api/move',who,{code,action:'ready'});
  const started=(await call('/api/move',a,{code,action:'start'})).data;
  assert.equal(started.turnClock.actor,a);assert.equal(started.turnClock.seconds,60);assert.ok(started.turnClock.deadline>started.serverNow);
  await store.withRoom(code,r=>{r.turnClock.deadline=Date.now()-100;r.deck=['skip','skip'];return {changed:true,reply:null}});
  const state=(await call('/api/state?code='+code,b)).data;
  assert.equal(state.turn,1);assert.equal(state.remaining,1);assert.equal(state.turnClock.actor,b);
  assert.equal(state.players[0].hand,undefined);assert.equal((await call('/api/state?code='+code,a)).data.remaining,1);
});

test('HTTP table options gate discard history and aggregate bomb risk for both players',async t=>{
  const {call,store}=await setup(t),a=randomUUID(),b=randomUUID();
  const {code}= (await call('/api/create',a,{name:'Host'})).data;await call('/api/join',b,{code,name:'Guest'});
  assert.equal((await call('/api/move',b,{code,action:'settings',showBombRisk:true})).status,400);
  assert.equal((await call('/api/move',a,{code,action:'settings',showDiscard:'yes'})).status,400);
  await call('/api/move',a,{code,action:'settings',showDiscard:true,showBombRisk:true,turnSeconds:0});
  for(const who of [a,b])await call('/api/move',who,{code,action:'ready'});await call('/api/move',a,{code,action:'start'});
  await store.withRoom(code,r=>{r.deck=['boom','skip','skip','skip'];r.discard=['attack','skip','nope'];return {changed:true,reply:null}});
  for(const who of [a,b]){const v=(await call('/api/state?code='+code,who)).data;assert.deepEqual(v.discard,['attack','skip','nope']);assert.equal(v.bombRisk.percent,25);assert.equal(v.deck,undefined)}
  assert.equal((await call('/api/move',a,{code,action:'settings',showDiscard:false})).status,400);
  await store.withRoom(code,r=>{r.showDiscard=false;r.showBombRisk=false;return {changed:true,reply:null}});
  const hidden=(await call('/api/state?code='+code,b)).data;assert.deepEqual(hidden.discard,['nope']);assert.equal(hidden.discardCount,3);assert.equal(hidden.bombRisk,null);
});

test('explosion preview has a public isolated link with autoplay and replay, without changing game UI',async t=>{
  const {base}=await setup(t);
  for(const path of ['/preview/explosion','/preview/explosion/']){
    const response=await fetch(base+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith('text/html'));
    const page=await response.text();assert.ok(page.startsWith('<!doctype html>'));assert.ok(page.includes('id="kaboom-explosion-preview"'));assert.ok(page.includes("window.addEventListener('load'"));assert.ok(page.includes('再看一次'));assert.ok(page.includes('/art/boom.jpg'));assert.ok(!page.includes('fetch('));assert.ok(!page.includes('window.openai'));
  }
  const head=await fetch(base+'/preview/explosion',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  const game=await (await fetch(base+'/play')).text();assert.ok(!game.includes('id="kaboom-explosion-preview"'));
});

test('an undefused elimination publishes the same explosion event to every player without leaking identity',async t=>{
  const {call,store}=await setup(t),a=randomUUID(),b=randomUUID();const {code}=(await call('/api/create',a,{name:'Host'})).data;
  await call('/api/join',b,{code,name:'Guest'});await call('/api/move',a,{code,action:'settings',turnSeconds:0});for(const who of [a,b])await call('/api/move',who,{code,action:'ready'});await call('/api/move',a,{code,action:'start'});
  await store.withRoom(code,r=>{r.players[0].hand=[];r.deck=['boom'];return {changed:true,reply:null}});
  const eliminated=(await call('/api/move',a,{code,action:'draw'})).data;assert.equal(eliminated.phase,'finished');assert.equal(eliminated.explosions.length,1);assert.equal(eliminated.explosions[0].player,a);
  const observer=(await call('/api/state?code='+code,b)).data;assert.equal(observer.explosions[0].id,eliminated.explosions[0].id);assert.equal(observer.explosions[0].player,'player-0');assert.ok(!JSON.stringify(observer).includes(a));
  assert.deepEqual((await call('/api/state?code='+code,b)).data.explosions,observer.explosions);
});

test('card effect previews have their own public URL, without adding action animations to gameplay',async t=>{
  const {base}=await setup(t);
  for(const path of ['/preview/cards','/preview/cards/','/preview/cards?card=defuse']){const response=await fetch(base+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith('text/html'));const page=await response.text();assert.ok(page.includes('id="cardSelect"'));assert.ok(page.includes('连续预览全部'));assert.ok(page.includes('TARGET LOCKED'));assert.ok(page.includes('DEFUSED ✓'));assert.ok(!page.includes('fetch('))}
  const head=await fetch(base+'/preview/cards',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal((await fetch(base+'/preview/toString')).status,404);
  for(const card of ['nope','attack','targeted','alter','peek','shuffle','skip','favor','bottom','defuse'])assert.equal((await fetch(base+'/art/'+card+'.jpg',{method:'HEAD'})).status,200);
  const game=await (await fetch(base+'/play')).text();assert.ok(!game.includes('id="cardSelect"'));assert.ok(!game.includes('TARGET LOCKED'));
});
