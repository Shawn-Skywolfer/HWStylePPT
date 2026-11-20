const width=s=>[...String(s||'')].reduce((n,c)=>n+(/[\u0000-\u00ff]/.test(c)?.55:1),0);
const lineCount=(s,w,font)=>String(s||'').split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(width(l)/((w-12)/font))),0);
export function analysisLayout(cards){
 if(!cards.length)return {font:18,heights:[]};if(cards.length>6)return null;
 for(const font of [18,17,16]){const heights=cards.map(c=>(c.label?lineCount(c.label,444,19)*25+5:0)+(c.text?lineCount(c.text,444,font)*font*1.42:0)+10);if(heights.reduce((a,b)=>a+b,0)+10*(cards.length-1)<=390)return {font,heights};}
 return null;
}
