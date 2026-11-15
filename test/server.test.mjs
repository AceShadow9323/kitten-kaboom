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
  for(const key of ['originalbox','partybox']){const image=await fetch(base+'/art/'+key+'.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');const bytes=new Uint8Array(await image.arrayBuffer());assert.equal(bytes[0],137);assert.equal(bytes[1],80)}
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
