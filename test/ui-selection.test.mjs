import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {html} from '../game/ui.mjs';
const PLAYER='11111111-1111-4111-8111-111111111111';
function selection(hand,mode='party') {
  const nodes=new Map();
  const make=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v},insertAdjacentHTML(_,v){this.innerHTML+=v}});return nodes.get(s)};
  const cards=hand.map((_,i)=>({dataset:{index:String(i)},setAttribute(k,v){this[k]=v},closest(){return {classList:{toggle(){}}}}}));
  const modes=()=>[...make('#selection').innerHTML.matchAll(/data-combo-count="(\d)"/g)].map(m=>{const b=make('mode-'+m[1]);b.dataset={comboCount:m[1]};return b});
  const context=vm.createContext({document:{body:{classList:{add(){},remove(){}}},querySelector:make,querySelectorAll:s=>s==='.table-hand .card'?cards:s==='[data-combo-count]'?modes():s==='[data-edition]'?['original','party'].map(edition=>{const b=make('edition-'+edition);b.dataset={edition};return b}):[]},sessionStorage:{getItem:k=>k==='kk-id'?PLAYER:null,setItem(){}},localStorage:{getItem:()=>null,setItem(){}},location:{origin:'https://example.test',search:''},URLSearchParams,setInterval(){},requestAnimationFrame(){},innerWidth:1200,innerHeight:900});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const room={code:'ABC234',host:PLAYER,mode,phase:'playing',turn:0,owed:1,remaining:30,discard:[],log:[],players:[{id:PLAYER,name:'Me',alive:true,count:hand.length,hand},{id:'player-1',name:'Friend',alive:true,count:5}]};
  vm.runInContext('room='+JSON.stringify(room)+';render()',context);
  return {context,cards,node:make,modes,selected:()=>JSON.parse(vm.runInContext('JSON.stringify(selected)',context))};
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

test('homepage removes the decorative star and changes box art with the edition picker',()=>{const s=selection(['skip']);vm.runInContext("room=null;selectedMode='original';landing()",s.context);assert.ok(s.node('#app').innerHTML.includes('/art/originalbox.png'));assert.ok(!s.node('#app').innerHTML.includes('class="spark"'));s.node('edition-party').onclick();assert.ok(s.node('#app').innerHTML.includes('/art/partybox.png'));assert.ok(!s.node('#app').innerHTML.includes('/art/originalbox.png'));s.node('edition-original').onclick();assert.ok(s.node('#app').innerHTML.includes('/art/originalbox.png'))});
