// Explicit protocol fixture, never selected by production defaults.
let input='';for await(const chunk of process.stdin)input+=chunk;
const request=JSON.parse(input);if(request.protocol!=='dashi.content-edit.v1')process.exit(2);
console.log(JSON.stringify({type:'progress',detail:'测试协议处理',percent:40}));
console.log(JSON.stringify({type:'result',result:{summary:'protocol-fixture-not-production-ai',operations:[]}}));
