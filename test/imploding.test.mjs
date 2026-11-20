import {test} from 'node:test';
import assert from 'node:assert/strict';
import {start,action,view,advanceBots,botDecision} from '../game/game.mjs';
function make(n=4,mode='party'){return {code:'ABC234',host:'a',mode,phase:'lobby',turnSeconds:0,imploding:true,players:Array.from({length:n},(_,i)=>({id:String.fromCharCode(97+i),name:'P'+i,ready:true})),log:[]}}
test('optional single Imploding card replaces one bomb, is not dealt, and defaults off',()=>{
 for(const mode of ['original','party'])for(let n=2;n<=(mode==='party'?10:5);n++){
  const r=make(n,mode);start(r,0);assert.equal(r.deck.filter(c=>c==='implode').length,1);assert.equal(r.deck.filter(c=>c==='boom').length,n-2);assert.ok(r.players.every(p=>p.hand.length===8&&!p.hand.includes('implode')));
  const off=make(n,mode);delete off.imploding;start(off,0);assert.ok(!off.deck.includes('implode'));assert.equal(off.deck.filter(c=>c==='boom').length,n-1);
 }
 const r=make();delete r.imploding;assert.throws(()=>action(r,'b',{action:'settings',imploding:true},0));action(r,'a',{action:'settings',imploding:true},0);assert.equal(r.imploding,true);assert.ok(r.players.every(p=>!p.ready));assert.throws(()=>action(r,'a',{action:'settings',imploding:'yes'},0));
});
test('first draw flips without using Defuse; any later face-up draw is fatal including same player under Attack',()=>{
 for(const same of [false,true]){
  const r=make();start(r,0);r.players.forEach(p=>p.hand=['defuse']);r.deck=['implode','skip','boom'];r.owed=same?2:1;r.attacked=same;
  action(r,'a',{action:'draw'},100);assert.equal(r.pending,'a');assert.equal(r.pendingKind,'implode');assert.deepEqual(r.players[0].hand,['defuse']);assert.equal(view(r,'a').pendingType,'implode');assert.equal(view(r,'b').pendingType,null);
  assert.throws(()=>action(r,'b',{action:'reinsert',position:0},101));assert.throws(()=>action(r,'a',{action:'draw'},101));
  action(r,'a',{action:'reinsert',position:0},200);assert.equal(r.deck[0],'implodeup');assert.equal(view(r,'b').topFaceUp,true);assert.equal(r.turn,same?0:1);assert.equal(r.owed,1);
  const victim=same?'a':'b',index=same?0:1;action(r,victim,{action:'draw'},300);assert.equal(r.players[index].alive,false);assert.deepEqual(r.players[index].hand,['defuse']);assert.equal(r.discard.at(-1),'implodeup');assert.equal(r.visualEvents.at(-1).type,'explosion');
 }
});
test('bottom draws, shuffling, private future cards and risk preserve face-up state without disclosing insertion index',()=>{
 const r=make();r.showBombRisk=true;start(r,0);r.players.forEach(p=>p.hand=[]);r.players[0].hand=['bottom','shuffle','peek'];r.deck=['skip','boom','implode'];r.owed=2;r.attacked=true;
 action(r,'a',{action:'play',index:0},100);assert.equal(r.pendingKind,'implode');
 action(r,'a',{action:'reinsert',position:2},200);assert.deepEqual(r.deck,['skip','boom','implodeup']);assert.equal(view(r,'b').topFaceUp,false);assert.equal(view(r,'b').bombRisk.percent,50);
 action(r,'a',{action:'play',index:0},300);assert.equal(r.deck.filter(c=>c==='implodeup').length,1);
 r.deck=['implodeup','skip','boom'];action(r,'a',{action:'play',index:0},400);assert.deepEqual(view(r,'a').players[0].peek,['implodeup','skip','boom']);assert.equal(view(r,'b').players[0].peek,undefined);assert.equal(view(r,'b').bombRisk.percent,100);
 const stranger=view(r,'b');assert.ok(!('deck' in stranger));assert.ok(!('position' in stranger));assert.equal(stranger.topFaceUp,true);
});
test('face-up bottom draw is fatal with Defuse; timers reinsert first draw; bots understand public danger',()=>{
 const r=make(2);start(r,0);r.players[0].hand=['bottom','defuse'];r.players[1].hand=['defuse'];r.deck=['skip','implodeup'];
 action(r,'a',{action:'play',index:0},100);assert.equal(r.phase,'finished');assert.equal(r.winner,'P1');assert.deepEqual(r.players[0].hand,['defuse']);
 const timed=make();timed.turnSeconds=30;start(timed,0);timed.players[0].hand=['defuse'];timed.deck=['implode','skip','boom'];action(timed,'a',{action:'draw'},100);advanceBots(timed,timed.turnClock.deadline);assert.equal(timed.pending,undefined);assert.ok(timed.deck.includes('implodeup'));assert.equal(timed.turn,1);
 const v=view(timed,'b');v.pending=true;v.pendingType='implode';assert.equal(botDecision(v,'b').position,v.remaining);
});
