import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
const html = await readFile('web/index.html', 'utf8');
const css = await readFile('web/style.css', 'utf8');
const js = await readFile('web/app.js', 'utf8');
const worker = await readFile('server/worker.js', 'utf8');
const extraAssets = {};
for (const [path, type] of [['admin.html','text/html'],['admin.css','text/css'],['admin.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],['sw.js','text/javascript'],['icon.svg','image/svg+xml'],['design-tokens.css','text/css'],['design-system.html','text/html'],['design-system.css','text/css'],['design-system.js','text/javascript'],['brand/mark.svg','image/svg+xml'],['brand/mark-inverse.svg','image/svg+xml'],['brand/mark-mono.svg','image/svg+xml'],['brand/wordmark.svg','image/svg+xml'],['brand/wordmark-inverse.svg','image/svg+xml']]) {
  extraAssets[path === 'admin.html' ? '/admin' : path === 'design-system.html' ? '/design-system' : '/' + path] = [await readFile('web/' + path, 'utf8'), type];
}
const binaryAssets = {};
for (const name of ['icon-192.png', 'icon-512.png']) binaryAssets['/' + name] = (await readFile('web/' + name)).toString('base64');
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', `const assets = ${JSON.stringify({ '/': [html, 'text/html'], '/style.css': [css, 'text/css'], '/app.js': [js, 'text/javascript'], ...extraAssets })};\nconst binaryAssets = ${JSON.stringify(binaryAssets)};\n${worker}`);
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Built Zavrill worker.');
