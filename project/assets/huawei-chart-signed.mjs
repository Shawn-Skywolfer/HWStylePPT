// Signed Cartesian geometry shared by static render and the live chart editor.
// Text stays in HTML so editable PPTX export and the Swiss validator agree.
export function signedChartMarkup(items,kind,text,{mixed=false,plotTop=294}={}){
 const values=items.map(v=>v.value),levels=[0];
 if(kind==='waterfall')for(const v of values)levels.push(levels.at(-1)+v);
 const domain=kind==='waterfall'?levels:[0,...values],magnitude=Math.max(...domain.map(Math.abs),1),lo=Math.min(...domain)/magnitude,hi=Math.max(...domain)/magnitude;
 const fraction=v=>(v/magnitude-lo)/(hi-lo||1),red='#c7000b',grey='#dbdbdb';
 let svg='',labels='';
 const rect=(x,y,w,h,fill,value)=>`<rect data-chart-value="${value}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
 if(kind==='bar'){
  const left=mixed?234:280,right=mixed?718:1000,zero=left+fraction(0)*(right-left),row=330/items.length;
  items.forEach((v,i)=>{const y=264+i*row,end=left+fraction(v.value)*(right-left),height=Math.min(mixed?28:32,row-12);svg+=rect(Math.min(zero,end),y+(row-height)/2,Math.abs(end-zero),height,v.value<0?red:grey,v.value);labels+=text(64,y,mixed?158:202,row,v.label,`font-size:${Math.min(mixed?16:20,row/1.4)}px;align-items:center`)+text(mixed?728:1016,y,mixed?90:184,row,v.value,`font-size:${Math.min(mixed?21:24,row/1.4)}px;font-weight:700;align-items:center;justify-content:flex-end`);});
  svg+=`<path data-chart-zero="${zero}" d="M${zero} 258V608M${left} 608H${right}" stroke="#888" fill="none"/>`;
  labels+=text(zero-16,610,32,24,'0','font-size:14px;justify-content:center');
 }else{
  const left=mixed?64:100,right=mixed?818:1200,top=Math.max(294,plotTop),bottom=544,y=v=>bottom-fraction(v)*(bottom-top),zero=y(0),count=items.length+(kind==='waterfall'?1:0),col=(right-left)/count;
  const label=(i,name,value,end,negative,computed=false)=>{
   const x=left+i*col;
   labels+=text(x,586,col-4,48,name,`font-size:${mixed?15:17}px;justify-content:center;text-align:center`)+text(x,negative?end+4:end-34,col-4,30,kind==='waterfall'&&!computed&&value>0?'+'+value:value,`font-size:${mixed?19:22}px;justify-content:center;font-weight:700`);
  };
  items.forEach((v,i)=>{
   const start=kind==='waterfall'?levels[i]:0,end=kind==='waterfall'?levels[i+1]:v.value,a=y(start),b=y(end),x=left+i*col;
   svg+=rect(x+col*.2,Math.min(a,b),col*.55,Math.abs(b-a),v.value<0?red:grey,v.value);
   if(kind==='waterfall')svg+=`<path d="M${x+col*.75} ${b}H${x+col*1.2}" stroke="#999" fill="none" stroke-dasharray="4 3"/>`;
   label(i,v.label,v.value,b,v.value<0);
  });
  if(kind==='waterfall'){
   const total=levels.at(-1),end=y(total),x=left+items.length*col;
   // Format only the derived sum at input precision, never round source values.
   const decimals=Math.min(12,Math.max(...values.map(v=>{const [base,exponent='0']=String(v).toLowerCase().split('e');return Math.max(0,(base.split('.')[1]?.length||0)-Number(exponent));})));
   const roundedTotal=Number(total.toFixed(decimals)),displayedTotal=roundedTotal===0&&total!==0?total:roundedTotal;
   svg+=rect(x+col*.2,Math.min(zero,end),col*.55,Math.abs(zero-end),'#707070',total);label(items.length,'合计（计算）',displayedTotal,end,total<0,true);
  }
  svg+=`<path data-chart-zero="${zero}" d="M${left} ${zero}H${right}" stroke="#888" fill="none"/>`;
  labels+=text(left-32,zero-12,28,24,'0','font-size:14px;justify-content:flex-end');
 }
 return {svg,labels};
}
