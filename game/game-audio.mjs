export function countdownPlan(previous,v,viewer,ms){
 const c=v?.turnClock;if(v?.phase!=='playing'||!c)return {state:null,cue:null};
 const stage=v.favor?'favor':v.alter?'alter':v.pending?'reinsert':'turn';
 const key=[v.code,v.roundId,v.drawKey,c.actor,stage].join(':');
 const state=previous?.key===key?{...previous}:{key,lowest:11};
 const second=Math.ceil(ms/1000);
 if(c.actor!==viewer||c.paused||v.endVote||ms<=0||second>10||second<1||second>=state.lowest)return {state,cue:null};
 state.lowest=second;return {state,cue:second};
}
export function playCountdownTick(context,second){
 const start=context.currentTime+.015,master=context.createGain(),nodes=[];
 master.gain.value=.35*.3*1.85;master.connect(context.destination);
 function beep(offset,level){const oscillator=context.createOscillator(),gain=context.createGain(),at=start+offset;oscillator.type='sine';oscillator.frequency.value=second<=3?1174.66:880;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.065);oscillator.connect(gain);gain.connect(master);oscillator.start(at);oscillator.stop(at+.075);nodes.push(oscillator)}
 beep(0,.65);if(second<=3)beep(.12,.5);
 let stopped=false;const stop=()=>{if(stopped)return;stopped=true;nodes.forEach(node=>{try{node.stop()}catch{}});master.disconnect()};setTimeout(stop,second<=3?240:120);return {stop};
}
export function cardSoundDelta(previous,v,now){
 const events=v.cardPlays??[],same=previous?.code===v.code&&previous.round===v.roundId;
 if(previous?.code===v.code&&Number.isFinite(previous.rev)&&Number.isFinite(v.rev)&&v.rev<previous.rev)return {state:previous,events:[]};
 const state={code:v.code,round:v.roundId,rev:v.rev,seq:Math.max(same?previous.seq:0,0,...events.map(e=>e.seq??0))};
 if(!previous||!same||!['playing','finished'].includes(v.phase))return {state,events:[]};
 return {state,events:events.filter(e=>e.seq>previous.seq&&now-e.at>=-1000&&now-e.at<3000).slice(-3)};
}
export const GAME_AUDIO_CLIENT=countdownPlan.toString()+'\n'+playCountdownTick.toString()+'\n'+cardSoundDelta.toString()+String.raw`
let countdownState=null,countdownCurrent=null,cardAudioSnapshot=null,cardAudioBuffer=null,cardAudioLoading=null,cardAudioNextTime=0;
const cardAudioSources=new Set();
function prepareGameplayCardAudio(){
 if(!turnSoundContext)return Promise.resolve(null);
 if(cardAudioBuffer)return Promise.resolve(cardAudioBuffer);
 if(!cardAudioLoading)cardAudioLoading=(async()=>{const response=await fetch('/sound/cardtake3.mp3');if(!response.ok)throw Error('Card audio unavailable');cardAudioBuffer=await turnSoundContext.decodeAudioData(await response.arrayBuffer());return cardAudioBuffer})().catch(()=>{cardAudioLoading=null;return null});
 return cardAudioLoading;
}
function stopGameplaySounds(){countdownCurrent?.stop();countdownCurrent=null;for(const source of cardAudioSources){try{source.stop()}catch{}}cardAudioSources.clear();cardAudioNextTime=0}
function updateCountdownSound(v,ms){
 const plan=countdownPlan(countdownState,v,id,ms),changed=plan.state?.key!==countdownState?.key;countdownState=plan.state;
 if(changed||!plan.state||v.turnClock?.paused||v.endVote||v.turnClock?.actor!==id||!turnSoundEnabled){countdownCurrent?.stop();countdownCurrent=null}
 if(plan.cue!==null&&turnSoundEnabled&&turnSoundContext?.state==='running'){countdownCurrent?.stop();try{countdownCurrent=playCountdownTick(turnSoundContext,plan.cue)}catch{}}
}
async function notifyPlayedCards(v){
 const delta=cardSoundDelta(cardAudioSnapshot,v,Date.now()+clockOffset);cardAudioSnapshot=delta.state;
 if(v.phase!=='playing'&&v.phase!=='finished')stopGameplaySounds();
 if(!delta.events.length||!turnSoundEnabled||turnSoundContext?.state!=='running')return;
 const expectedCode=v.code,expectedRound=v.roundId,buffer=await prepareGameplayCardAudio();
 if(!buffer||!turnSoundEnabled||room?.code!==expectedCode||room?.roundId!==expectedRound||!['playing','finished'].includes(room.phase)||turnSoundContext.state!=='running')return;
 const recent=delta.events.filter(e=>Date.now()+clockOffset-e.at<3000);
 for(const event of recent){const at=Math.max(turnSoundContext.currentTime+.015,cardAudioNextTime);if(at-turnSoundContext.currentTime>1.2)break;try{const source=turnSoundContext.createBufferSource(),gain=turnSoundContext.createGain();source.buffer=buffer;gain.gain.value=.5;source.connect(gain);gain.connect(turnSoundContext.destination);cardAudioSources.add(source);source.onended=()=>{cardAudioSources.delete(source);gain.disconnect()};source.start(at);cardAudioNextTime=at+buffer.duration+.025}catch{}}
}
`;
