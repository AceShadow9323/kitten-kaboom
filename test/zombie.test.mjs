import {test} from 'node:test';import assert from 'node:assert/strict';
import {start,action,view,advanceBots} from '../game/game.mjs';
import {zombieCounts} from '../game/zombie.mjs';
function make(n=4){const r={code:'ABC234',mode:'zombie',host:'a',turnSeconds:0,players:Array.from({length:n},(_,i)=>({id:String.fromCharCode(97+i),name:'P'+i,ready:true})),log:[]};start(r,0);r.players.forEach(p=>p.hand=[]);r.deck=['skip','boom','peek','boom','shuffle'];return r}
test('Zombie setup has exact paw/plain/full counts, no Defuse, eight starting cards',()=>{for(const n of [2,3,4,5]){const r={code:'ABC234',mode:'zombie',host:'a',players:Array.from({length:n},(_,i)=>({id:''+i,name:''+i,ready:true})),log:[]};start(r,0);assert.equal(r.mode,'zombie');assert.ok(r.players.every(p=>p.hand.length===8&&p.hand.includes('zombie')&&!p.hand.includes('defuse')));assert.equal(r.deck.filter(c=>c==='boom').length,n-1);assert.equal([...r.deck,...r.players.flatMap(p=>p.hand)].length,(n===2?24:n===3?33:57)+n-1);assert.equal(Object.values(zombieCounts(n)).reduce((a,b)=>a+b,0)+n,n===2?24:n===3?33:57)}});
test('death keeps a hand and Zombie saves require revival and two secret insertions',()=>{
 const r=make();r.deck=['boom','boom','skip','peek'];r.players[0].hand=['nope'];action(r,'a',{action:'draw'},100);assert.equal(r.players[0].alive,false);assert.deepEqual(r.players[0].hand,['nope']);assert.equal(r.players[0].deadBomb,true);
 r.players[0].hand=[];r.players[1].hand=['zombie','skip'];action(r,'b',{action:'draw'},200);assert.equal(r.zombiePending.stage,'decision');action(r,'b',{action:'zombieuse'},201);assert.equal(r.zombiePending.stage,'revive');action(r,'b',{action:'revive',target:'a'},202);assert.equal(r.players[0].alive,true);assert.equal(r.zombiePending.remaining,2);
 action(r,'b',{action:'reinsert',position:0},203);assert.equal(r.pending,'b');action(r,'b',{action:'reinsert',position:2},204);assert.equal(r.pending,undefined);assert.equal(r.turn,2);assert.equal(r.deck.filter(c=>c==='boom').length,2);assert.deepEqual(r.players[1].hand,['skip']);
});
test('players can voluntarily die, dead holders can Nope, and last living wins',()=>{
 const r=make(3);r.players[0].hand=['zombie','nope'];r.deck=['boom','skip','peek'];action(r,'a',{action:'draw'},100);action(r,'a',{action:'zombiedie'},101);assert.equal(r.players[0].alive,false);r.players[1].hand=['attack'];action(r,'b',{action:'play',index:0},200);assert.ok(r.stack);action(r,'a',{action:'nope'},201);assert.equal(r.stack,undefined);assert.equal(r.turn,1);r.deck=['boom'];action(r,'b',{action:'draw'},300);assert.equal(r.phase,'finished');assert.equal(r.winner,'P2');
});
test('NOW shuffle interrupts a Nope window, resumes it; Feed Dead and Grave Robber collect secret cards',()=>{
 const r=make();r.players[0].hand=['attack'];r.players[1].hand=['nope'];r.players[2].alive=false;r.players[2].deadBomb=true;r.players[2].hand=['shufflenow','feeddead'];action(r,'a',{action:'play',index:0},100);
 action(r,'c',{action:'play',index:0},200);assert.equal(r.stack.card,'shufflenow');assert.equal(r.suspended.length,1);action(r,'b',{action:'allow'},201);assert.equal(r.stack.card,'attack');action(r,'b',{action:'allow'},202);assert.equal(r.turn,1);
 r.players[1].hand=['skip'];r.players[0].hand=['peek'];r.players[3].hand=['favor'];action(r,'c',{action:'play',index:0,target:'c'},300);assert.equal(r.collect.kind,'feed');for(const id of ['a','b','d'])action(r,id,{action:'contribute',index:0},301);assert.equal(r.collect,undefined);assert.equal(r.players[2].hand.length,3);
 r.players[1].hand=['grave'];action(r,'b',{action:'play',index:0},400);action(r,'c',{action:'contribute',index:0},401);assert.equal(r.collect,undefined);assert.equal(r.players[2].hand.length,2);
});
test('Dig Deeper decision is private and Clone copies an action, not another Clone',()=>{
 const r=make();r.players[0].hand=['dig','clone'];r.deck=['boom','skip','peek'];action(r,'a',{action:'play',index:0},100);assert.equal(view(r,'a').dig.card,'boom');assert.equal(view(r,'b').dig.card,undefined);action(r,'a',{action:'digchoose',choice:'next'},101);assert.equal(r.deck[0],'boom');assert.equal(r.turn,1);
 r.turn=0;r.players[0].hand=['clone'];r.discard=['superskip'];r.owed=4;action(r,'a',{action:'play',index:0},200);assert.equal(r.turn,1);assert.equal(r.owed,1);r.turn=0;r.players[0].hand=['clone'];assert.throws(()=>action(r,'a',{action:'play',index:0},201));
});
test('Clairvoyance exposes reinsert positions only to observer; timers complete Zombie decisions',()=>{
 const r=make();r.players[0].hand=['zombie'];r.players[1].hand=['clair'];r.deck=['boom','skip','peek'];action(r,'a',{action:'draw'},100);action(r,'a',{action:'zombieuse'},101);action(r,'b',{action:'play',index:0},102);action(r,'a',{action:'reinsert',position:1},103);assert.deepEqual(view(r,'b').clairvoyance.positions,[{position:1,total:3}]);assert.equal(view(r,'c').clairvoyance,null);
 const t=make();t.turnSeconds=30;t.players[0].hand=['zombie'];t.deck=['boom','skip'];action(t,'a',{action:'draw'},100);advanceBots(t,t.turnClock.deadline);assert.equal(t.zombiePending.stage,'insert');advanceBots(t,t.turnClock.deadline);assert.equal(t.pending,undefined);
});

test('nested Clairvoyance response windows finish before secret insertion, and Clone can form own cat pair',()=>{
 const r=make();r.players[0].hand=['zombie'];r.players[1].hand=['nope'];r.players[2].hand=['clair'];r.players[3].hand=['clair'];r.deck=['boom','skip','peek'];action(r,'a',{action:'draw'},100);action(r,'a',{action:'zombieuse'},101);action(r,'c',{action:'play',index:0},102);action(r,'d',{action:'play',index:0},103);action(r,'b',{action:'allow'},104);assert.equal(r.stack.actor,'c');assert.throws(()=>action(r,'a',{action:'reinsert',position:0},105));action(r,'b',{action:'allow'},106);action(r,'a',{action:'reinsert',position:1},107);assert.equal(view(r,'c').clairvoyance.positions.length,1);assert.equal(view(r,'d').clairvoyance.positions.length,1);
 const pair=make();pair.players[0].hand=['clone','decat'];pair.players[1].hand=['zombie'];action(pair,'a',{action:'play',indices:[0,1],target:'b'},100);assert.deepEqual(pair.players[0].hand,['zombie']);assert.deepEqual(pair.discard,['decat','clone']);
});

test('responses cannot accidentally target a newly interrupted or restored Nope window',()=>{
 const r=make();r.players[0].hand=['attack'];r.players[1].hand=['nope'];r.players[2].hand=['shufflenow'];action(r,'a',{action:'play',index:0},100);const first=r.stack.id;action(r,'c',{action:'play',index:0},101);assert.notEqual(r.stack.id,first);assert.throws(()=>action(r,'b',{action:'allow',stackId:first},102),/changed/);action(r,'b',{action:'allow',stackId:r.stack.id},103);assert.equal(r.stack.id,first);
});
