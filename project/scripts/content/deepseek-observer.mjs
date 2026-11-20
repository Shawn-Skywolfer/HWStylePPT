// Invocation-local metadata only. Never emit prompt, reasoning text, response text or credentials.
export const name='dashi-bridge-observer';
export function apply(ctx,_config={},internals={}){
 const states=new Map();
 const write=internals.write||(line=>process.stdout.write(line));
 const send=(phase,fields={})=>write(JSON.stringify({type:'dashi_bridge',phase,...fields})+'\n');
 send('observer_ready',{observerVersion:1});
 ctx.on('agent/assistant-stream',({agent,frame})=>{
  const id=String(agent.id),s=states.get(id)||{reasoningChars:0,textChars:0,lastEmit:0,started:false};states.set(id,s);
  if(frame.type==='start'){s.started=true;send('request_started',{sessionId:id});return;}
  if(frame.type==='end'){send('request_ended',{sessionId:id,reasoningChars:s.reasoningChars,textChars:s.textChars});return;}
  const c=frame.chunk;if(!c)return;
  if(c.type==='reasoning-delta')s.reasoningChars+=String(c.text||'').length;
  else if(c.type==='text-delta')s.textChars+=String(c.text||'').length;
  else if(c.type==='error'){send('request_error',{sessionId:id,errorCode:String(c.error?.code||'MODEL_STREAM_ERROR').slice(0,80)});return;}
  else return;
  const now=Date.now();if(now-s.lastEmit<1000)return;s.lastEmit=now;
  send(c.type==='reasoning-delta'?'reasoning':'writing',{sessionId:id,reasoningChars:s.reasoningChars,textChars:s.textChars});
 });
 ctx.on('session/event',(session,event)=>{
  if(event.type!=='llm/retry')return;const d=event.data||{};
  send('provider_retry',{sessionId:String(session.id||''),retry:Number(d.retry||0),errorCode:String(d.error?.code||d.code||'MODEL_RETRY').slice(0,80),delayMs:Number(d.delayMs||0)});
 });
 ctx.on('agent/error',({agent,error})=>send('agent_error',{sessionId:String(agent.id),errorCode:String(error?.code||'AGENT_ERROR').slice(0,80)}));
}
