import {randomUUID} from 'node:crypto';
// Explicitly public fields only. Never copy a room, move payload, token, deck or hand.
export function auditState(room) {
 return {phase:room.phase,mode:room.mode??'original',turn:room.turn??null,
   turnName:room.players[room.turn]?.name??null,owed:room.owed??0,
   remaining:room.deck?.length??0,attacked:!!room.attacked,
   pendingDefuse:!!room.pending,nopeCount:room.stack?.nopes??null,
   waiting:room.endVote?'vote':room.stack?'nope':room.favor?'favor':room.alter?'alter':room.pending?'reinsert':null,
   players:room.players.map((p,index)=>({index,name:p.name,alive:p.alive!==false,count:p.hand?.length??0}))};
}
export function appendAudit(room,{before,sequence,actor,source}) {
 const entry={id:randomUUID(),at:new Date().toISOString(),code:room.code,
   roundId:room.roundId??null,revision:room.rev??0,source,
   actor:actor??null,messages:(room.logEvents??[]).filter(e=>e.seq>sequence).map(e=>({at:e.at,text:e.text})),
   before,after:auditState(room)};
 (room.auditLog??=[]).push(entry);room.auditLog=room.auditLog.slice(-500);return entry;
}
export function writeAudit(entry) { console.log(JSON.stringify({kind:'game-audit',...entry})); }
