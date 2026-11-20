export const ZOMBIE_UI=String.raw`
const zombieCats=['decat','electrocat','lanterncat','vampirecat'],zombieNow=['shufflenow','feeddead','clair'];
function isComboCard(c){return ['tacocat','meloncat','potatocat','beardcat','rainbowcat','feral',...zombieCats].includes(c)||room?.mode==='zombie'&&c==='clone'}
function canPlayNow(c){if(room?.mode!=='zombie'||!zombieNow.includes(c)||room.phase!=='playing'||room.endVote)return false;if(c==='clair')return room.zombiePending?.stage==='insert';if(room.pending||room.zombiePending||room.favor||room.alter||room.dig||room.collect)return false;return c!=='feeddead'||room.players.some(p=>!p.alive)}
function canUseHandCard(c,receiving,finished,myTurn,blocked){return !finished&&!room.endVote&&(receiving||canPlayNow(c)||myTurn&&!blocked)}
function renderZombieResponse(me){
 if(room.mode!=='zombie')return false;
 const z=room.zombiePending;
 if(z){
  const who=room.players.find(p=>p.id===z.actor)?.name;
  if(z.actor!==id){$('#response').innerHTML='<strong>'+esc(who)+'</strong> 正在'+(z.stage==='decision'?'选择使用 Zombie Kitten 或死亡':z.stage==='revive'?'选择复活的玩家':'秘密放回炸弹')+'。';return true}
  if(z.stage==='decision'){
   const hasZombie=me.hand.includes('zombie'),hasClone=me.hand.includes('clone')&&room.discard.at(-1)==='zombie';
   $('#response').innerHTML='<div class="response-inline"><strong>抽到炸弹：要使用 Zombie Kitten 吗？</strong><div class="actions"><button class="primary" id="zombieSave">'+(hasZombie?'使用 Zombie Kitten':'使用 Clone 复制 Zombie Kitten')+'</button>'+(hasZombie&&hasClone?'<button class="secondary" id="zombieClone">改用 Clone</button>':'')+'<button class="secondary" id="zombieDie">选择死亡，保留手牌</button></div></div>';
   $('#zombieSave').onclick=()=>move('zombieuse');if($('#zombieClone')?.isConnected)$('#zombieClone').onclick=()=>move('zombieuse',{useClone:true});$('#zombieDie').onclick=()=>move('zombiedie');
  }else if(z.stage==='revive'){
   $('#response').innerHTML='<div class="response-inline"><strong>必须救回一名死者</strong><select id="reviveTarget" aria-label="Choose Dead player">'+room.players.filter(p=>!p.alive).map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+p.count+' cards</option>').join('')+'</select><button class="primary" id="revivePlayer">复活玩家</button></div>';$('#revivePlayer').onclick=()=>move('revive',{target:$('#reviveTarget').value});
  }else{
   $('#response').innerHTML='<div class="response-inline reinsert-inline"><strong>秘密放回炸弹 · 剩余 '+z.remaining+' 张</strong><label for="zombiePosition" style="margin:0;font-size:11px">0 = 顶部 · '+room.remaining+' = 底部</label><input id="zombiePosition" type="number" min="0" max="'+room.remaining+'" value="0" aria-label="Zombie Kitten reinsertion position"><button class="primary" id="zombieInsert">放回这一张</button></div>';$('#zombieInsert').onclick=()=>move('reinsert',{position:Number($('#zombiePosition').value)});
  }return true;
 }
 if(room.dig){
  if(room.dig.actor===id){const c=room.dig.card;$('#response').innerHTML='<section class="alter-panel"><strong>Dig Deeper · 仅你可见</strong><div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;margin:12px"><img src="'+art(c,room.dig.art)+'" alt="'+esc(names[c])+'" style="width:82px;border-radius:8px"><button class="primary" id="digKeep">保留这一张</button><button class="secondary" id="digNext">必须抽下一张</button></div><p>选下一张时，当前这张会放回牌堆顶部。</p></section>';$('#digKeep').onclick=()=>move('digchoose',{choice:'keep'});$('#digNext').onclick=()=>move('digchoose',{choice:'next'})}
  else $('#response').innerHTML='等待 <strong>'+esc(room.players.find(p=>p.id===room.dig.actor)?.name)+'</strong> 选择 Dig Deeper。';return true;
 }
 if(room.collect){const needed=room.collect.waiting.includes(id),recipient=room.players.find(p=>p.id===room.collect.recipient)?.name;$('#response').innerHTML='<strong>'+(room.collect.kind==='feed'?'Feed the Dead · 给 '+esc(recipient):'Grave Robber · 放进抽牌堆')+'</strong> '+(needed?'点击你的一张手牌交出。':'等待其他玩家选择手牌。');return true}
 return false;
}
`;
