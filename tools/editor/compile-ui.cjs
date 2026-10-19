const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function compileClient(sourceRoot){
 const result=ts.transpileModule(fs.readFileSync(path.join(sourceRoot,'editor/ui/client.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const directory=path.join(sourceRoot,'.local-editor/ui');
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'client.js'),result);
}
module.exports={compileClient};
