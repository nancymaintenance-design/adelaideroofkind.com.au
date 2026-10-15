const fs = require('node:fs');
const path = require('node:path');

const publicResources = [
  'apple-touch-icon.png', 'favicon-192.png', 'favicon-32.png', 'favicon-48.png',
  'favicon-512.png', 'favicon-ellis-services.png', 'favicon.ico', 'feed.json',
  'llms.txt', 'local-services-feed.json', 'local-services-rss.xml', 'robots.txt',
  'rss.xml', 'site.webmanifest', 'sitemap.xml',
];
const assetTypes = {
  brand: new Set(['.svg','.png','.jpg','.webp']),
  css: new Set(['.css']),
  fonts: new Set(['.woff2','.woff','.txt']),
  images: new Set(['.svg','.png','.jpg','.jpeg','.webp','.gif','.ico']),
  js: new Set(['.js']),
};

function checkRealPath(target) {
  if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Symbolic link is not allowed: ${target}`);
  const real = path.resolve(fs.realpathSync(target));
  const expected = path.resolve(target);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(real) !== normalize(expected)) throw new Error(`Unexpected real path: ${target}`);
}

function checkTree(directory) {
  checkRealPath(directory);
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    const target = path.join(directory, entry.name);
    checkRealPath(target);
    if (entry.isDirectory()) checkTree(target);
    else if (!entry.isFile()) throw new Error(`Not a regular file: ${target}`);
  }
}

function validateBuildPaths(source, output) {
  if (!path.isAbsolute(source) || !path.isAbsolute(output) || path.resolve(output) !== path.join(path.resolve(source),'dist')) throw new Error('Build target must be the exact absolute source/dist directory.');
  checkRealPath(source);
  if (!fs.statSync(source).isDirectory()) throw new Error('Source must be a directory.');
  if (fs.existsSync(output)) {
    checkTree(output);
    if (!fs.statSync(output).isDirectory()) throw new Error('dist must be a generated directory.');
  } else {
    // existsSync also returns false for a dangling symlink.
    try { fs.lstatSync(output); throw new Error('Unexpected dist target.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function collectPublicFiles(source) {
  const output = [];
  const add = relative => {
    const target = path.join(source,relative);
    checkRealPath(target);
    if (!fs.statSync(target).isFile()) throw new Error(`Not a regular public file: ${relative}`);
    output.push(relative);
  };
  for (const name of fs.readdirSync(source).sort()) if (/^[^.][^/\\]*\.html$/.test(name)) add(name);
  function assets(directory, category) {
    checkRealPath(path.join(source,directory));
    for (const entry of fs.readdirSync(path.join(source,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const relative = path.join(directory,entry.name);
      checkRealPath(path.join(source,relative));
      if (entry.name.startsWith('.')) throw new Error(`Hidden asset is not public: ${relative}`);
      if (entry.isDirectory()) assets(relative,category);
      else {
        if (!assetTypes[category].has(path.extname(entry.name).toLowerCase())) throw new Error(`Unsupported public asset: ${relative}`);
        add(relative);
      }
    }
  }
  checkRealPath(path.join(source,'assets'));
  for (const name of fs.readdirSync(path.join(source,'assets')).sort()) {
    checkRealPath(path.join(source,'assets',name));
    if (!assetTypes[name]) throw new Error(`Unsupported asset directory: ${name}`);
    assets(path.join('assets',name),name);
  }
  for (const name of publicResources) add(name);
  if (!output.includes('index.html') || !output.includes('404.html')) throw new Error('Home and 404 documents are required.');
  return output.sort();
}

function buildStatic() {
  const source = path.resolve(__dirname,'..');
  const output = path.join(source,'dist');
  validateBuildPaths(source,output);
  const files = collectPublicFiles(source);
  // Recheck the exact validated generated target immediately before cleaning.
  validateBuildPaths(source,output);
  if (fs.existsSync(output)) fs.rmSync(output,{recursive:true});
  fs.mkdirSync(output);
  for (const relative of files) {
    const target = path.join(output,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(source,relative),target);
  }
  console.log(`Built ${files.length} public files into ${output}`);
  return files;
}

module.exports = { validateBuildPaths, collectPublicFiles, buildStatic };
if (require.main === module) {
  try { buildStatic(); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
