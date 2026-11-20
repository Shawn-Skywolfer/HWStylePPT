// CSS px are measured on the original 1280 × 720 artwork. 1pt = 4/3px.
export const HW_BODY_FONT_INCREASE_PT=2;
export const HW_BODY_FONT_INCREASE_PX=HW_BODY_FONT_INCREASE_PT*4/3;
export const HW_TITLE=Object.freeze({x:64,y:40,width:1020,fontSize:34,lineHeight:1.25,fontWeight:700,letterSpacing:-.02});

export function enlargeHwBodyCss(css){
 return css.replace(/([^{}]+)\{([^{}]*)\}/g,(rule,selector,body)=>{
  // Keep the approved page heading, KPI numbers/units, drawn arrow glyphs,
  // chart axes, provenance footer and editor dialogs at their original scale.
  if(/\bh1\b|\.(?:source|template-tag|slide-footer|hero-value|metric-value|highlight-value|highlight-unit|transform-arrow|feedback-arrow|chart-unit|chart-x-labels|chart-legend|hbar-row|donut-center|radar-label)\b|chart-data-/.test(selector))return rule;
  return selector+'{'+body.replace(/font-size\s*:\s*([^;}]+)(?=[;} ]|$)/g,(_,value)=>{
   const important=/!important/.test(value)?'!important':'',size=value.replace(/!important/g,'').trim();
   const inner=size.startsWith('calc(')&&size.endsWith(')')?size.slice(5,-1):size;
   return `font-size:calc(${inner} + ${HW_BODY_FONT_INCREASE_PT}pt)${important}`;
  })+'}';
 });
}
