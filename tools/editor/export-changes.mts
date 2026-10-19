import {pages,sourceRoot} from './manifest.mts';
import {editorContent,checkedChanges} from './content.mts';
import {readDraft} from './store.mts';
import {join} from 'node:path';
const selected=process.argv[2];
if(selected&&!pages.some(page=>page.pageId===selected))throw Error('页面未登记，请使用后台显示的页面文件名。');
const results=[];
for(const page of pages.filter(page=>!selected||page.pageId===selected)){
 const draft=await readDraft(join(sourceRoot,'.local-editor/drafts'),page.pageId);
 if(!draft)continue;
 const model=editorContent(page.pageId),changes=checkedChanges(model,draft);
 if(!Object.keys(changes).length)continue;
 results.push({pageId:page.pageId,sourceFile:page.file,revision:draft.revision,baseHash:draft.baseHash,state:'needs-translation',changes:model.fields.filter(field=>changes[field.id]!==undefined).map(field=>({fieldId:field.id,sourcePath:field.sourcePath,kind:field.kind,englishBefore:field.value,chineseBefore:field.publishedValue,chineseAfter:changes[field.id]}))});
}
console.log(JSON.stringify({site:'Adelaide Roof Kind',localOnly:true,generatedAt:new Date().toISOString(),pages:results},null,2));
