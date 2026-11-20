import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countdownPlan,cardSoundDelta} from '../game/game-audio.mjs';
import {start,action,view} from '../game/game.mjs';
const room={code:'ABC234',roundId:'r1',drawKey:'step1',phase:'playing',turnClock:{actor:'a',paused:false}};
test('last ten seconds beep only once per second for decision owner; pause/resume cannot replay seconds',()=>{
 let state=null;const seen=[];
 for(const ms of [11000,10000,9900,9000,8950,3000,2990,2000,1000,0]){const result=countdownPlan(state,room,'a',ms);state=result.state;if(result.cue!==null)seen.push(result.cue)}
 assert.deepEqual(seen,[10,9,3,2,1]);
 assert.equal(countdownPlan(null,room,'b',9000).cue,null);
 const initial=countdownPlan(null,room,'a',9000);
 const paused=countdownPlan(initial.state,{...room,turnClock:{actor:'a',paused:true}},8500);
 assert.equal(paused.cue,null);assert.equal(countdownPlan(paused.state,room,'a',8500).cue,null);
 assert.equal(countdownPlan(paused.state,room,'a',8000).cue,8);
 assert.equal(countdownPlan(paused.state,{...room,drawKey:'next-step'},'a',10000).cue,10);
 assert.equal(countdownPlan(null,{...room,endVote:{}},'a',5000).cue,null);
 assert.equal(countdownPlan(null,{...room,phase:'finished'},'a',5000).cue,null);
});
test('card recordings skip history, duplicates, stale snapshots and old offline events',()=>{
 const v={code:'ABC234',roundId:'r1',phase:'playing',rev:1,cardPlays:[{id:'e1',seq:1,at:1000,actor:'a'}]};
 const first=cardSoundDelta(null,v,1000);assert.deepEqual(first.events,[]);
 const next={...v,rev:2,cardPlays:[...v.cardPlays,{id:'e2',seq:2,at:2000,actor:'b'}]};
 const fresh=cardSoundDelta(first.state,next,2100);assert.deepEqual(fresh.events.map(e=>e.id),['e2']);
 assert.deepEqual(cardSoundDelta(fresh.state,next,2200).events,[]);
 assert.deepEqual(cardSoundDelta(fresh.state,v,2200).state,fresh.state);
 assert.deepEqual(cardSoundDelta(first.state,next,6000).events,[]);
 assert.deepEqual(cardSoundDelta(fresh.state,{...next,roundId:'new'},2200).events,[]);
});
test('public card-play events cover cats and Nope without revealing hands or credentials',()=>{
 const r={code:'ABC234',host:'a',mode:'party',turnSeconds:0,players:['a','b','c','d'].map(id=>({id,name:id,ready:true})),log:[]};start(r,0);
 r.players.forEach(p=>p.hand=[]);r.players[0].hand=['tacocat','tacocat'];r.players[1].hand=['nope','SECRET'];r.players[2].hand=['nope'];r.players[3].hand=[];
 action(r,'a',{action:'play',indices:[0,1],target:'b'},100);action(r,'b',{action:'nope'},200);
 const publicEvents=view(r,'d').cardPlays;
 assert.deepEqual(publicEvents.map(e=>e.seq),[1,2]);assert.deepEqual(publicEvents.map(e=>e.actor),['player-0','player-1']);
 assert.ok(publicEvents.every(e=>Object.keys(e).sort().join(',')==='actor,at,id,seq'));assert.ok(!JSON.stringify(publicEvents).includes('SECRET'));
 assert.throws(()=>action(r,'d',{action:'play',index:99},300));assert.equal(r.cardPlays.length,2);
 start(r,400);assert.deepEqual(r.cardPlays,[]);
});
