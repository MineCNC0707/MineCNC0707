import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await cp('public','dist',{recursive:true});
for(const file of ['three.module.js','three.core.js'])await cp(`node_modules/three/build/${file}`,`dist/vendor/${file}`);
await cp('node_modules/three/LICENSE','dist/vendor/THREE-LICENSE.txt');
console.log('Built static assets with pinned Three.js 0.186.0');
