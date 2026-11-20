import {test} from 'node:test';import assert from 'node:assert/strict';import {syncArtwork,playerArtwork,artworkView} from '../game/card-art.mjs';import {start,action} from '../game/game.mjs';
function room(){const r={code:'ABC234',mode:'original',host:'a',players:[{id:'a',name:'A',ready:true},{id:'b',name:'B',ready:true}],log:[],turnSeconds:0};start(r,0);r.players[0].hand=['skip','skip'];r.players[1].hand=['favor'];r.deck=['skip','skip','boom'];r.discard=[];syncArtwork(r);return r}
test('same-kind cards have distinct stable artwork and playing selected duplicate keeps its exact face',()=>{
 const r=room(),before=playerArtwork(r,'a').handArt;assert.notEqual(before[0],before[1]);action(r,'a',{action:'play',index:1},100);syncArtwork(r,{action:'play',index:1},'a');assert.deepEqual(playerArtwork(r,'a').handArt,[before[0]]);assert.equal(artworkView(r,'b').discardArt[0],before[1]);const snapshot=JSON.stringify(r.cardArt);assert.equal(syncArtwork(r),false);assert.equal(JSON.stringify(r.cardArt),snapshot);
});
test('drawing and giving a duplicate preserve the specific artwork; public view has no deck or other hands',()=>{
 const r=room(),top=r.cardArt.zones.deck[0].art;action(r,'a',{action:'draw'},100);syncArtwork(r,{action:'draw'},'a');assert.equal(playerArtwork(r,'a').handArt.at(-1),top);
 r.turn=0;r.players[0].hand=['skip','skip'];r.players[1].hand=[];r.favor={actor:'b',target:'a'};syncArtwork(r);const chosen=playerArtwork(r,'a').handArt[0];action(r,'a',{action:'give',index:0},200);syncArtwork(r,{action:'give',index:0},'a');assert.equal(playerArtwork(r,'b').handArt[0],chosen);assert.ok(!('deck' in artworkView(r,'b')));assert.ok(!('handArt' in artworkView(r,'b')));
 const all=Object.values(r.cardArt.zones).flat();assert.equal(new Set(all.map(c=>c.uid)).size,all.length);
});
