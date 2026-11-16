import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../previews/cards.html',import.meta.url),'utf8');
const types=['nope','attack','targeted','alter','peek','shuffle','skip','favor','bottom','defuse'];
function preview({reduced=false,search=''}={}){
  const nodes=new Map(),timers=[],events={};
  function node(key){if(!nodes.has(key)){const classes=new Set();nodes.set(key,{innerHTML:'',textContent:'',value:'',dataset:{},src:'',alt:'',offsetWidth:900,classes,classList:{add(...names){names.forEach(n=>classes.add(n))},remove(...names){names.forEach(n=>classes.delete(n))}},handlers:{},addEventListener(type,handler){this.handlers[type]=handler},setAttribute(k,v){this[k]=v},async decode(){}})}return nodes.get(key)}
  function buttons(){return [...node('#picker').innerHTML.matchAll(/data-card="([a-z]+)"/g)].map(m=>{const b=node('button-'+m[1]);b.dataset.card=m[1];return b})}
  const context=vm.createContext({document:{querySelector:node,querySelectorAll:s=>s==='[data-card]'?buttons():[]},location:{search},URLSearchParams,innerWidth:1200,matchMedia:()=>({matches:reduced}),window:{addEventListener:(name,fn)=>events[name]=fn},setTimeout:(fn,ms)=>timers.push({fn,ms})});
  vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const flush=async()=>{await Promise.resolve();await Promise.resolve()};
  return {node,timers,buttons,async load(){await events.load();await flush()},async click(id){await node(id).handlers.click();await flush()},async tick(){const t=timers.shift();assert.ok(t);t.fn();await flush();return t.ms},async choose(id){await node('button-'+id).handlers.click();await flush()}};
}
test('all ten action cards have selectable distinct effects, with no cat-card previews',async()=>{
  const p=preview();assert.deepEqual(p.buttons().map(b=>b.dataset.card),types);
  for(const type of types){await p.choose(type);assert.equal(p.node('#scene').dataset.effect,type);assert.equal(p.node('#cardImage').src,'/art/'+type+'.jpg');assert.ok(p.node('#scene').classes.has('playing'));assert.ok(p.node('#effects').innerHTML.length>20);assert.equal(p.node('button-'+type)['aria-pressed'],'true');assert.equal(p.node('#cardSelect').value,type)}
  for(const cat of ['tacocat','beardcat','potatocat','rainbowcat','meloncat','feral'])assert.ok(!p.node('#picker').innerHTML.includes('data-card="'+cat+'"'));
  await p.choose('targeted');assert.ok(p.node('#effects').innerHTML.includes('TARGET LOCKED'));await p.choose('alter');assert.equal((p.node('#effects').innerHTML.match(/class="future-card"/g)||[]).length,3);await p.choose('defuse');assert.ok(p.node('#effects').innerHTML.includes('DEFUSED ✓'));assert.ok(p.node('#effects').innerHTML.includes('class="scissors"'));
});
test('autoplay, replay and deep links use the selected card, while stale timers cannot change a newer selection',async()=>{
  const p=preview({search:'?card=targeted'});await p.load();assert.equal(p.node('#scene').dataset.effect,'targeted');await p.choose('defuse');await p.tick();assert.equal(p.node('#scene').dataset.effect,'defuse');assert.equal(p.node('#status').textContent,'播放中');await p.tick();assert.equal(p.node('#status').textContent,'预览结束 · 可重播');await p.click('#replay');assert.equal(p.node('#scene').dataset.effect,'defuse');
});
test('play-all cycles once through all ten effects and can be stopped',async()=>{
  const p=preview();await p.click('#playAll');const seen=[];
  for(let i=0;i<types.length;i++){seen.push(p.node('#scene').dataset.effect);await p.tick()}
  assert.deepEqual(seen,types);assert.equal(p.node('#status').textContent,'全部预览完成');assert.equal(p.node('#playAll').textContent,'连续预览全部');
  await p.click('#playAll');await p.click('#playAll');await p.tick();assert.equal(p.node('#scene').dataset.effect,'nope');assert.equal(p.node('#status').textContent,'预览结束 · 可重播');
});
test('reduced motion shortens the preview and the mobile selector plays its chosen effect',async()=>{
  const p=preview({reduced:true});await p.load();assert.ok(p.node('#scene').classes.has('reduced'));assert.equal(p.timers[0].ms,1000);await p.node('#cardSelect').handlers.change({target:{value:'shuffle'}});assert.equal(p.node('#scene').dataset.effect,'shuffle');assert.ok(p.node('#effects').innerHTML.includes('shuffle-card'));
});
