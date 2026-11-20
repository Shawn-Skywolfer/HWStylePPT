const norm=v=>String(v??'').replace(/\s+/g,'');
// Imported original HW blocks retain their richer source fields. Their neutral
// text is a joined reading order, not the value of a single DOM text field.
export function validateRichHwFields(slide,rendered,props){
 const errors=[],originals=slide.blocks.filter(b=>b.origin?.hw?.card),extras=slide.blocks.filter(b=>b.origin?.hw?.copyKeys);
 if(rendered.cards.length!==originals.length)errors.push('原稿内容块数量改变');
 for(const block of originals){const matches=rendered.cards.filter(c=>c.id===block.blockId);if(matches.length!==1){errors.push('内容块 '+block.blockId+' 未唯一呈现');continue;}const actual=matches[0],expected=block.origin.hw.card;
  for(const key of ['label','heading','date','text','meta','output','evidence']){if(key==='text'&&expected.items?.some(v=>String(v).trim()))continue;const value=expected[key]||'';if(key in actual.fields){if(actual.fields[key]!==value)errors.push('内容块 '+block.blockId+' 的 '+key+' 丢失、改写或串位');}else if(value&&!norm(actual.visibleText).includes(norm(value)))errors.push('内容块 '+block.blockId+' 的 '+key+' 未可见呈现');}
  if(expected.items?.some(v=>String(v).trim())&&JSON.stringify(actual.items)!==JSON.stringify(expected.items.filter(v=>String(v).trim())))errors.push('内容块 '+block.blockId+' 的分层条目丢失或串位');
  if(block.data?.kind==='metric'){if(!String(actual.metricValue??'').trim()||Number(actual.metricValue)!==block.data.value)errors.push('内容块 '+block.blockId+' 的指标数值不一致');for(const key of ['unit','delta','detail'])if(block.data[key]&&!norm(actual.visibleText).includes(norm(block.data[key])))errors.push('内容块 '+block.blockId+' 的指标 '+key+' 未显示');}
  if(block.data?.kind==='table'){const t=block.data,a=actual.table;if(!a||JSON.stringify(a.headers.map(norm))!==JSON.stringify(t.headers.map(norm))||JSON.stringify(a.rows.map(r=>r.map(norm)))!==JSON.stringify(t.rows.map(r=>r.cells.map(norm))))errors.push('内容块 '+block.blockId+' 的表格行列或单元格内容不一致');for(const group of t.rows.map(r=>r.group).filter(Boolean))if(!norm(actual.visibleText).includes(norm(group)))errors.push('内容块 '+block.blockId+' 的表格分组未显示');}
 }
 for(const block of extras)for(const key of block.origin.hw.copyKeys){const expected=props.original?.[key];if(typeof expected!=='string'||!expected.trim())continue;const value=rendered.sourceCopy?.[key];if(value!=null?value!==expected:!norm(rendered.visibleText).includes(norm(expected)))errors.push('原稿辅助文字 '+key+' 未可见呈现或被改写');}
 return errors;
}
