import {digArtwork} from './card-art.mjs';
export const ZOMBIE_CATS=['decat','electrocat','lanterncat','vampirecat'];
export const ZOMBIE_ACTIONS=['superskip','attackdead','shufflenow','feeddead','grave','dig','clair'];
export const ZOMBIE_NOW=['shufflenow','feeddead','clair'];
export function zombieCounts(n){
 const paw={zombie:2,attack:2,attackdead:0,nope:2,skip:1,superskip:1,peek:2,shufflenow:1,feeddead:0,clone:1,grave:0,favor:1,dig:2,clair:1,...Object.fromEntries(ZOMBIE_CATS.map(c=>[c,2]))};
 const plain={zombie:3,attack:0,attackdead:3,nope:3,skip:2,superskip:1,peek:2,shufflenow:1,feeddead:2,clone:2,grave:1,favor:2,dig:2,clair:1,...Object.fromEntries(ZOMBIE_CATS.map(c=>[c,2]))};
 const counts=n===2?paw:n===3?plain:Object.fromEntries(Object.keys(paw).map(c=>[c,paw[c]+plain[c]]));
 return {...counts,zombie:counts.zombie-n};
}
export function canZombieSave(r,p){return p.hand.includes('zombie')||(r.discard.at(-1)==='zombie'&&p.hand.includes('clone'))}
export function zombieDeath(r,p,h){p.alive=false;p.deadBomb=true;delete r.pending;delete r.pendingKind;delete r.zombiePending;(r.explosions??=[]).push({id:crypto.randomUUID(),player:p.id});h.visualEvent(r,'explosion',p.id);h.say(r,p.name+' died and kept their hand. An Exploding Kitten is in front of them.');if(r.players.filter(p=>p.alive).length===1){r.phase='finished';r.winner=r.players.find(p=>p.alive).name}else h.next(r)}
export function zombieDraw(r,p,c,h){
 if(r.mode!=='zombie'||c!=='boom')return false;
 if(!canZombieSave(r,p)){zombieDeath(r,p,h);return true}
 r.pending=p.id;r.pendingKind='zombie';r.zombiePending={actor:p.id,stage:'decision',remaining:1,watchers:[],positions:[]};h.say(r,p.name+' drew an Exploding Kitten: choose Zombie Kitten or choose to die.');return true;
}
export function zombieAfter(r,now){
 if(r.mode!=='zombie'||r.stack||r.favor||r.alter||r.dig||r.collect||!r.suspended?.length)return false;if(r.pending&&!(r.zombiePending?.stage==='insert'&&r.suspended.at(-1).stack.card==='clair'))return false;
 const previous=r.suspended.pop();r.stack=previous.stack;r.stack.deadline=now+previous.left;return true;
}
export function validateZombieCard(r,p,c,target){
 if(['attackdead','grave','feeddead'].includes(c)&&!r.players.some(p=>!p.alive))throw Error('This card needs at least one Dead player.');
 if(c==='feeddead'&&(!target||target.alive))throw Error('Choose a Dead player for Feed the Dead.');
 if(c==='clair'&&r.zombiePending?.stage!=='insert')throw Error('Play Clairvoyance while a Zombie Kitten is returning kittens.');
 if(!ZOMBIE_NOW.includes(c)&&(!p.alive||r.players[r.turn].id!==p.id))throw Error('This card can only be played on your living turn.');
}
export function zombiePrepare(r,p,b,now,h){
 if(r.mode!=='zombie')return false;
 const zp=r.zombiePending;
 if(['zombieuse','zombiedie','revive'].includes(b.action)||b.action==='reinsert'&&zp){
  if(!zp||zp.actor!==p.id||r.stack)throw Error('Wait for your Zombie Kitten decision.');
  if(b.action==='zombiedie'){if(zp.stage!=='decision')throw Error('The Zombie Kitten was already played.');zombieDeath(r,p,h);return true}
  if(b.action==='zombieuse'){
   if(zp.stage!=='decision')throw Error('Already saved.');
   const kind=b.useClone?'clone':p.hand.includes('zombie')?'zombie':'clone',index=p.hand.indexOf(kind);
   if(index<0||kind==='clone'&&r.discard.at(-1)!=='zombie')throw Error('A Zombie Kitten or a Clone on a Zombie Kitten is needed.');
   p.hand.splice(index,1);r.discard.push(kind);h.cardPlay(r,p.id);h.say(r,p.name+' played '+(kind==='clone'?'Clone as ':'')+'Zombie Kitten.');
   zp.stage=r.players.some(p=>!p.alive)?'revive':'insert';return true;
  }
  if(b.action==='revive'){
   const dead=h.target(r,b.target);if(zp.stage!=='revive'||!dead||dead.alive||!dead.deadBomb)throw Error('Choose a Dead player.');
   dead.alive=true;delete dead.deadBomb;zp.remaining=2;zp.stage='insert';h.say(r,p.name+' brought '+dead.name+' back to life with their hand intact.');return true;
  }
  if(zp.stage!=='insert')throw Error('Choose whether to save yourself and whom to revive first.');
  const position=Number(b.position);if(!Number.isInteger(position)||position<0||position>r.deck.length)throw Error('Choose a valid deck position.');
  zp.positions.push({position,total:r.deck.length+1});r.deck.splice(position,0,'boom');zp.remaining--;
  if(!zp.remaining){r.clairvoyance={actor:p.id,watchers:[...zp.watchers],positions:[...zp.positions]};delete r.zombiePending;delete r.pending;delete r.pendingKind;h.say(r,p.name+' secretly returned the Exploding Kitten(s).');h.end(r)}
  return true;
 }
 if(b.action==='digchoose'){
  if(r.dig?.actor!==p.id||r.stack||!['keep','next'].includes(b.choice))throw Error('Choose the revealed card or the next card.');
  const held=r.dig.card;let drawn=held;
  if(b.choice==='next'){drawn=r.deck.shift();r.deck.unshift(held)}
  delete r.dig;h.drawCard(r,p,false,drawn);return true;
 }
 if(b.action==='contribute'){
  const collect=r.collect;if(!collect?.waiting.includes(p.id)||r.stack)throw Error('You are not choosing a card now.');
  const index=Number(b.index);if(!Number.isInteger(index)||!p.hand[index])throw Error('Choose a card from your hand.');
  const card=p.hand.splice(index,1)[0];if(collect.kind==='feed')h.target(r,collect.recipient).hand.push(card);else r.deck.push(card);
  collect.waiting=collect.waiting.filter(id=>id!==p.id);h.say(r,p.name+' chose a card for '+(collect.kind==='feed'?'Feed the Dead.':'Grave Robber.'));
  if(!collect.waiting.length){if(collect.kind==='grave')h.shuffle(r.deck);delete r.collect}return true;
 }
 if(b.action!=='play')return false;
 const indices=b.indices??[b.index];if(!Array.isArray(indices))return false;
 if(indices.length>1&&indices.some(i=>p.hand[i]==='clone')){if(indices.filter(i=>p.hand[i]==='clone').length>1)throw Error('A Clone cannot copy another Clone.');b.indices=[...indices.filter(i=>p.hand[i]!=='clone'),...indices.filter(i=>p.hand[i]==='clone')]}
 if(indices.length===1&&p.hand[indices[0]]==='clone'){
  if(!p.alive||r.players[r.turn].id!==p.id)throw Error('Clone can only be played on your living turn.');
  const copied=r.discard.at(-1);if(!copied||['clone','zombie','boom','implodeup','implode'].includes(copied))throw Error('Clone needs an eligible card on top of the discard pile.');
  if(copied==='nope'&&r.stack){if(now>=r.stack.deadline||b.stackId!==undefined&&b.stackId!==r.stack.id)throw Error('This response window has closed.');p.hand.splice(indices[0],1);r.discard.push('clone');h.cardPlay(r,p.id);r.stack.nopes++;r.stack.passed=[];r.stack.deadline=now+8000;h.visualEvent(r,'nope',p.id,r.stack.actor);h.say(r,p.name+' played Clone as Nope.');return true}
  b.zombieEffective=copied;
 }
 const c=b.zombieEffective??p.hand[indices[0]];
 if(indices.length===1&&ZOMBIE_NOW.includes(c)){
  validateZombieCard(r,p,c,h.target(r,b.target));
  if(r.favor||r.alter||r.dig||r.collect||r.pending&&c!=='clair')throw Error('Wait until the current action is finished.');
  if(r.stack){(r.suspended??=[]).push({stack:r.stack,left:Math.max(0,r.stack.deadline-now)});delete r.stack}
  b.zombieNow=true;
 }
 return false;
}
export function zombieResolve(r,s,p,t,h){
 if(r.mode!=='zombie')return false;
 if(s.card==='superskip'){r.owed=1;h.end(r)}
 else if(s.card==='attackdead'){const debt=(r.attacked?r.owed:0)+3*r.players.filter(p=>!p.alive).length;h.next(r);r.owed=debt;r.attacked=true}
 else if(s.card==='shufflenow')h.shuffle(r.deck);
 else if(s.card==='feeddead'){r.collect={kind:'feed',recipient:t.id,waiting:r.players.filter(x=>x.alive&&x.id!==p.id&&x.hand.length).map(x=>x.id)};if(!r.collect.waiting.length)delete r.collect}
 else if(s.card==='grave'){r.collect={kind:'grave',waiting:r.players.filter(x=>!x.alive&&x.hand.length).map(x=>x.id)};if(!r.collect.waiting.length){h.shuffle(r.deck);delete r.collect}}
 else if(s.card==='dig'){if(r.deck.length>1){r.dig={actor:p.id,card:r.deck.shift()};r.clockEpoch=(r.clockEpoch??0)+1}}
 else if(s.card==='clair'){if(r.zombiePending?.stage==='insert'&&!r.zombiePending.watchers.includes(p.id))r.zombiePending.watchers.push(p.id)}
 else return false;
 h.say(r,p.name+' resolved '+s.card+'.');return true;
}
export function zombieView(r,id,pub){
 const z=r.zombiePending;return {zombiePending:z?{actor:pub(z.actor),stage:z.stage,remaining:z.remaining,...(z.watchers.includes(id)||z.actor===id?{positions:z.positions}: {})}:null,
 dig:r.dig?{actor:pub(r.dig.actor),...(r.dig.actor===id?{card:r.dig.card,art:digArtwork(r)}:{})}:null,
 collect:r.collect?{kind:r.collect.kind,recipient:r.collect.recipient?pub(r.collect.recipient):null,waiting:r.collect.waiting.map(pub)}:null,
 clairvoyance:r.clairvoyance&&(r.clairvoyance.watchers.includes(id)||r.clairvoyance.actor===id)?{positions:r.clairvoyance.positions}:null};
}
