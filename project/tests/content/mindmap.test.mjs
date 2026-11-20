import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {documentToTree,treeToDocument,indexTree,createChild,createSibling,removeNode,moveNode,shiftNode,indentNode,duplicateBranch,documentToMarkdown,markdownToTree,layoutMindmap,addField} from '../../scripts/content/mindmap-model.mjs';
import {ProjectStore} from '../../scripts/content/store.mjs';import {createWorkbenchServer} from '../../scripts/content/server.mjs';import {compileContent} from '../../scripts/content/compile.mjs';
const demo=()=>normalizeDocument(JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url))));
test('mindmap and annotated Markdown roundtrip every field, real data, sources and IDs',()=>{
 const d=demo();d.slides[1].blocks[0].text='引号 " 与 <script>\n第二行 & 中文';d.slides[1].blocks[0].data={kind:'bar',labels:['甲','乙'],values:[12,20],unit:'万元'};d.slides[1].media=[{src:'assets/user-media/source.png',kind:'image',caption:'素材'}];
 const md=documentToMarkdown(d),back=normalizeDocument(treeToDocument(markdownToTree(md)));assert.deepEqual(back,d);assert.ok(!md.includes('<script>'));assert.ok(md.includes('- '));assert.equal(back.slides[1].blocks[0].text,d.slides[1].blocks[0].text);
});
test('nested body branches become complete structured Markdown content, never discarded',()=>{
 const t=documentToTree(demo()),id=createChild(t,'b:demo-b3'),n=indexTree(t).nodes.get(id);n.text='补充论据';const child=createChild(t,id);indexTree(t).nodes.get(child).text='案例说明';const d=normalizeDocument(treeToDocument(t)),b=d.slides[2].blocks[0];assert.ok(b.text.endsWith('- 补充论据\n  - 案例说明'));assert.equal(b.contentTree.children[0].children[0].text,'案例说明');assert.deepEqual(normalizeDocument(treeToDocument(markdownToTree(documentToMarkdown(d)))),d);
});
test('sibling creation, deletion and reparenting preserve unrelated content',()=>{
 const t=documentToTree(demo()),id=createSibling(t,'b:demo-b3');indexTree(t).nodes.get(id).text='新事实';const base=t.children[1].children.filter(n=>n.kind==='block').length;moveNode(t,id,'s:demo-summary','child');let d=normalizeDocument(treeToDocument(t));assert.equal(d.slides[1].blocks.length,base+1);assert.ok(d.slides[1].blocks.some(b=>b.label==='新事实'));removeNode(t,id);d=normalizeDocument(treeToDocument(t));assert.equal(d.slides[1].blocks.length,base);assert.throws(()=>removeNode(t,'deck'));
});
test('mindmap sibling order controls content order and default sequence relationships',()=>{
 const t=documentToTree(demo());shiftNode(t,'b:demo-b5',-1);const d=normalizeDocument(treeToDocument(t));assert.deepEqual(d.slides[2].blocks.map(b=>b.blockId),['demo-b3','demo-b5','demo-b4']);assert.equal(d.slides[2].board.edges[0].to,'block:demo-b5');const c=compileContent(d);assert.equal(c.mapping.slides[2].blocks[1].blockId,'demo-b5');
});
test('indent/outdent rejects cycles and disallowed semantic levels',()=>{
 const t=documentToTree(demo()),a=createChild(t,'b:demo-b3'),b=createSibling(t,a);indentNode(t,b);assert.equal(indexTree(t).parents.get(b).id,a);assert.throws(()=>moveNode(t,a,b));indentNode(t,b,true);assert.equal(indexTree(t).parents.get(b).kind,'body');assert.throws(()=>moveNode(t,'s:demo-summary','b:demo-b3'));assert.throws(()=>indentNode(t,'b:demo-b3'));const data=addField(t,'b:demo-b3','data');assert.throws(()=>createChild(t,data));
});
test('plain Markdown imports a rightward topic / page / block / nested detail tree',()=>{
 const t=markdownToTree('# 新主题\n## 页面论点\n### 核心观点\n正文说明\n- 证据一\n  - 子证据\n- 证据二',demo()),d=normalizeDocument(treeToDocument(t));assert.equal(d.title,'新主题');assert.equal(d.slides.length,1);assert.ok(d.slides[0].blocks[0].text.includes('  - 子证据'));assert.equal(d.brief.confirmed,true);
});
test('duplicating a page renews all stable IDs and preserves relation endpoints',()=>{
 const t=documentToTree(demo()),id=duplicateBranch(t,'s:demo-risks'),d=normalizeDocument(treeToDocument(t)),copy=d.slides.find(s=>'s:'+s.slideId===id);assert.ok(copy);assert.equal(copy.blocks.length,3);assert.ok(copy.blocks.every(b=>!['demo-b3','demo-b4','demo-b5'].includes(b.blockId)));assert.equal(copy.board.edges[0].from,'block:'+copy.blocks[0].blockId);assert.equal(indexTree(documentToTree(d)).nodes.has(id),true);
});
test('rightward layout keeps all descendants right of parents and has no sibling overlap',()=>{
 const t=documentToTree(demo()),l=layoutMindmap(t);for(const edge of l.links){const a=l.nodes.find(n=>n.id===edge.from),b=l.nodes.find(n=>n.id===edge.to);assert.ok(b.x>a.x+a.w);}for(const n of indexTree(t).order){const children=l.nodes.filter(b=>n.children.some(c=>c.id===b.id)).sort((a,b)=>a.y-b.y);for(let i=1;i<children.length;i++)assert.ok(children[i].y>=children[i-1].y+children[i-1].h);}assert.ok(layoutMindmap(t,new Set(t.children.map(c=>c.id))).nodes.length<l.nodes.length);
});
test('draft and confirmed Markdown persist with undo/redo and cannot overwrite original',t=>{
 const dir=path.resolve('.test-tmp/mindmap-store-'+Date.now()),s=new ProjectStore(dir);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let p=s.create(demo());const original=fs.readFileSync(path.join(dir,'content-original.md'),'utf8'),doc=structuredClone(p.current);doc.slides[1].title='新的页面判断';p=s.edit(p.revision,doc);assert.ok(fs.readFileSync(path.join(dir,'content-current.md'),'utf8').includes('新的页面判断'));p=s.action(p.revision,'undo');assert.ok(!fs.readFileSync(path.join(dir,'content-current.md'),'utf8').includes('新的页面判断'));p=s.action(p.revision,'redo');p=s.action(p.revision,'confirm');assert.ok(fs.existsSync(path.join(dir,'content-confirmed.md')));assert.equal(fs.readFileSync(path.join(dir,'content-original.md'),'utf8'),original);
});
test('CLI refuses creation and browser launch before Agent intake, without starting UI',t=>{
 const dir=path.resolve('.test-tmp/mindmap-intake-'+Date.now());fs.mkdirSync(dir,{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const d=demo();d.brief.confirmed=false;fs.writeFileSync(path.join(dir,'draft.json'),JSON.stringify(d));const result=spawnSync(process.execPath,['scripts/content-workbench.mjs','create','--project',path.join(dir,'project'),'--plan',path.join(dir,'draft.json')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.ok(result.stderr.includes('AGENT_INTAKE_REQUIRED'));assert.equal(fs.existsSync(path.join(dir,'project/content-plan.json')),false);
});
test('Markdown HTTP import uses revision checks, validates and remains undoable',async t=>{
 const dir=path.resolve('.test-tmp/mindmap-api-'+Date.now()),s=new ProjectStore(dir);s.create(demo());const app=createWorkbenchServer(dir);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.engine.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});});const url='http://127.0.0.1:'+app.server.address().port,headers={'x-workbench-token':app.token,'content-type':'application/json'},md=(await fetch(url+'/api/markdown',{headers}).then(r=>r.json())).markdown,p=s.read();const text=md.replace('交付协同带动经营提质','脑图主题已修改');const r=await fetch(url+'/api/markdown',{method:'POST',headers,body:JSON.stringify({revision:p.revision,markdown:text})});assert.equal(r.status,200);assert.equal(s.read().current.title,'脑图主题已修改');const failed=await fetch(url+'/api/markdown',{method:'POST',headers,body:JSON.stringify({revision:s.read().revision,markdown:'无效'})});assert.equal(failed.status,422);assert.equal(s.read().current.title,'脑图主题已修改');const undone=s.action(s.read().revision,'undo');assert.equal(undone.current.title,demo().title);
});
