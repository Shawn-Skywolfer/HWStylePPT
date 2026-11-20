let input='';for await(const chunk of process.stdin)input+=chunk;const kind=process.argv[2];
const result={summary:'Host protocol fixture, not a real model',operations:[{op:'replaceText',slideId:'test-only',target:{field:'title'},before:'原稿',after:'候选'}]};
if(kind==='deepseek'||kind==='deepseek-linger'||kind==='deepseek-live'||kind==='deepseek-recovered'){if(kind==='deepseek-live'){console.log(JSON.stringify({type:'dashi_bridge',phase:'reasoning',reasoningChars:500,textChars:0}));console.log(JSON.stringify({type:'text',text:JSON.stringify(result)}));}if(kind==='deepseek-recovered')console.log(JSON.stringify({type:'error',message:'Transient retry fixture'}));console.log(JSON.stringify({type:'final',text:JSON.stringify(result),reason:{kind:'completed'}}));if(kind==='deepseek-linger')setInterval(()=>{},1000);}
else if(kind==='deepseek-error')console.log(JSON.stringify({type:'final',text:'',reason:{kind:'error',error:{code:'ACCOUNT_SIGN_IN_REQUIRED',message:'Sign in is required'}}}));
else if(kind==='silent-timeout'){console.log(JSON.stringify({type:'status',phase:'model-wait'}));setInterval(()=>{},1000);}
else if(kind==='codex')console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));
else if(kind==='claude')console.log(JSON.stringify({type:'result',result:JSON.stringify(result)}));
else if(kind==='opencode')console.log(JSON.stringify({type:'text',part:{text:JSON.stringify(result)}}));
else {if(JSON.parse(input).protocol!=='dashi.content-edit.v1')throw new Error('Invalid generic protocol');console.log(JSON.stringify(result));}
