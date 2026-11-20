import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrivalSnapshot,playTurnTone,SOUND_NAMES,turnPreviewHTML,turnRaysMarkup} from '../game/turn-alert.mjs';
import {html} from '../game/ui.mjs';
const room={code:'ABC234',roundId:'r1',phase:'playing',turn:0,players:[{id:'a'},{id:'b'}]};
test('turn arrival only flashes for an actual arrival, not refresh, polling, extra draws or vote pause',()=>{
 let state=arrivalSnapshot(null,room,100);assert.equal(state.until,0);
 state=arrivalSnapshot(state,{...room,turn:1},200);assert.equal(state.actor,'b');assert.equal(state.until,1050);
 state=arrivalSnapshot(state,{...room,turn:1,owed:1,endVote:{}},300);assert.equal(state.startedAt,200);assert.equal(state.until,1050);
 const lobby=arrivalSnapshot(state,{...room,phase:'lobby'},400);
 assert.equal(arrivalSnapshot(lobby,{...room,roundId:'r2'},500).until,1350);
 assert.equal(arrivalSnapshot(state,{...room,code:'NEW234',turn:1},600).until,0);
});
test('four distinct short sound options have bounded gain and scheduled oscillator cleanup',()=>{
 const frequencies=[],stops=[],gains=[],delays=[],nodes=[];
 const context={currentTime:0,destination:{},createGain(){const node={gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(v){gains.push(v)},exponentialRampToValueAtTime(v){assert.ok(v>0)}},connect(){},disconnect(){this.disconnected=true}};nodes.push(node);return node},createOscillator(){return {frequency:{set value(v){frequencies.push(v)}},connect(){},start(){},stop(at){stops.push(at)}}}};
 const original=setTimeout;globalThis.setTimeout=(fn,ms)=>{delays.push(ms);fn()};
 try{for(const [type]of SOUND_NAMES){const duration=playTurnTone(context,type,1);assert.ok(duration>0&&duration<1)}}finally{globalThis.setTimeout=original}
 assert.equal(SOUND_NAMES.length,4);assert.ok(stops.every(at=>at<1));assert.ok(delays.every(ms=>ms<1200));assert.ok(nodes.filter(n=>n.disconnected).every(n=>n.gain.value<=.3));
 assert.ok(new Set(frequencies).size>=7);assert.ok(gains.every(v=>v<=.5));
});
test('preview is click-to-play; live game includes arrival rays but no sound activation',()=>{
 assert.equal((turnRaysMarkup().match(/<g /g)||[]).length,16);
 for(const [type]of SOUND_NAMES)assert.ok(turnPreviewHTML.includes('data-sound="'+type+'"'));
 assert.ok(turnPreviewHTML.includes('await audio.resume()'));assert.ok(!turnPreviewHTML.includes('autoplay'));assert.ok(!turnPreviewHTML.includes('fetch('));
 assert.ok(html.includes('turn-arriving'));assert.ok(!html.includes('AudioContext'));assert.ok(!html.includes('playTurnTone('));
});
