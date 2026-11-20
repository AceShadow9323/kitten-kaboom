import {CARD_ART} from './art-manifest.mjs';
const normalized=c=>c==='implodeup'?'implode':c;
function zones(r){const z={deck:r.deck??[],discard:r.discard??[]};for(const p of r.players)z['hand:'+p.id]=p.hand??[];z.pending=r.pending?Array(r.zombiePending?.remaining??1).fill(r.pendingKind==='implode'?'implode':'boom'):[];for(const p of r.players)z['dead:'+p.id]=p.deadBomb?['boom']:[];z.dig=r.dig?[r.dig.card]:[];return z}
function lcs(old,types,used){const n=old.length,m=types.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=!used.has(old[i].uid)&&normalized(old[i].type)===normalized(types[j])?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);const result=Array(m).fill(null);let i=0,j=0;while(i<n&&j<m){if(!used.has(old[i].uid)&&normalized(old[i].type)===normalized(types[j])&&dp[i][j]===1+dp[i+1][j+1]){result[j]=old[i];used.add(old[i].uid);i++;j++}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++}return result}
export function syncArtwork(r,move={},actor){
 const current=zones(r),signature=JSON.stringify(current),previous=r.cardArt;
 const shuffled=!!previous&&previous.round===r.roundId&&((r.visualEvents??[]).some(e=>e.seq>(previous.visualSeq??0)&&e.type==='shuffle')||(r.logEvents??[]).some(e=>e.seq>(previous.logSequence??0)&&e.text.includes('resolved shufflenow'))||previous.collectKind==='grave'&&!r.collect);if(previous&&previous.round===r.roundId&&previous.signature===signature&&!shuffled)return false;
 const same=!!previous&&previous.round===r.roundId,old=same?structuredClone(previous.zones):{},used=new Set(),fixed={};
 function fix(zone,index,record){if(record&&current[zone]?.[index]!==undefined&&normalized(current[zone][index])===normalized(record.type)){(fixed[zone]??={})[index]=record;used.add(record.uid)}}
 const moved=[];if(same&&r.drawSequence>(previous.drawSequence??0)&&old.deck?.length&&!(move.action==='digchoose'&&move.choice==='keep')){const bottom=(r.visualEvents??[]).some(e=>e.seq>(previous.visualSeq??0)&&e.type==='bottom');moved.push(...old.deck.splice(bottom?old.deck.length-1:0,1))}if(shuffled&&old.deck)for(let i=old.deck.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[old.deck[i],old.deck[j]]=[old.deck[j],old.deck[i]]}const hand=old['hand:'+actor]??[];if(['give','contribute'].includes(move.action)&&Number.isInteger(Number(move.index))&&hand[Number(move.index)])moved.push(...hand.splice(Number(move.index),1));
 const indices=move.indices??(move.index!==undefined?[Number(move.index)]:[]);
 if(move.action==='play'||move.action==='nope'||move.action==='zombieuse'){
  let removed=r.mode==='zombie'&&indices.length>1?[...indices].sort((a,b)=>Number(hand[a]?.type==='clone')-Number(hand[b]?.type==='clone')):indices;
  if(move.action==='nope')removed=[hand.findIndex(c=>c.type==='nope')];
  if(move.action==='zombieuse')removed=[hand.findIndex(c=>c.type===(move.useClone?'clone':hand.some(c=>c.type==='zombie')?'zombie':'clone'))];
  const start=old.discard?.length??0;removed.forEach((i,n)=>fix('discard',start+n,hand[i]));
 }
 if(move.action==='reinsert')fix('deck',Number(move.position),old.pending?.[0]);
 if(move.action==='reorder'&&Array.isArray(move.order)&&old.deck){const n=move.order.length;old.deck=[...move.order.map(i=>old.deck[i]),...old.deck.slice(n)]}
 const assigned={};
 for(const [zone,types]of Object.entries(current)){const available=old[zone]??[],reserved=fixed[zone]??{},cleanTypes=types.map((t,i)=>reserved[i]?'!reserved!':t);assigned[zone]=lcs(available,cleanTypes,used);for(const [i,record]of Object.entries(reserved))assigned[zone][i]=record}
 const pool={};for(const records of [moved,...Object.values(old)])for(const record of records)if(!used.has(record.uid))(pool[normalized(record.type)]??=[]).push(record);
 const counts=same?{...previous.counts}:{};
 function fresh(type){const kind=normalized(type),options=CARD_ART[kind]??[kind],index=counts[kind]??Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]%options.length);counts[kind]=index+1;return {uid:crypto.randomUUID(),type,art:options[index%options.length]}}
 for(const [zone,types]of Object.entries(current))for(let i=0;i<types.length;i++){assigned[zone][i]??=pool[normalized(types[i])]?.shift()??fresh(types[i]);assigned[zone][i].type=types[i]}
 const peeks=same?previous.peeks??{}:{};
 for(const p of r.players){if(!p.peek){delete peeks[p.id];continue}const seq=(r.visualEvents??[]).filter(e=>e.type==='peek'&&e.actor===p.id).at(-1)?.seq??0,sig=JSON.stringify(p.peek);if(!peeks[p.id]||peeks[p.id].seq!==seq||peeks[p.id].signature!==sig)peeks[p.id]={seq,signature:sig,arts:assigned.deck.slice(0,p.peek.length).map(c=>c.art)}}
 r.cardArt={round:r.roundId,signature,zones:assigned,counts,peeks,visualSeq:r.visualSequence??0,drawSequence:r.drawSequence??0,logSequence:r.logSequence??0,collectKind:r.collect?.kind};return true;
}
export function artworkView(r,id){const z=r.cardArt?.zones;return z?{discardArt:(r.showDiscard?z.discard:z.discard.slice(-1)).map(c=>c.art),topArt:r.deck?.[0]==='implodeup'?z.deck[0]?.art:null}:{}}
export function playerArtwork(r,id){return r.cardArt?{handArt:(r.cardArt.zones['hand:'+id]??[]).map(c=>c.art),peekArt:r.cardArt.peeks[id]?.arts}:{}}
export function deckArtwork(r){return (r.cardArt?.zones.deck??[]).map(c=>c.art)}
export function digArtwork(r){return r.cardArt?.zones.dig?.[0]?.art}
