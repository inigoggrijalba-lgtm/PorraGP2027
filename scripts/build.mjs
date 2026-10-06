// Compila la app en dist/: un JS y un CSS con huella en el nombre, más los archivos de public/.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extra = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
const require = createRequire(import.meta.url);
const esbuild = require(require.resolve('esbuild', { paths: [root, ...extra] }));

const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });

const result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/main.jsx'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: extra,
  outdir: 'dist/assets',
  entryNames: 'app',
  write: false,
  logLevel: 'info',
});

const names = {};
for (const file of result.outputFiles) {
  const ext = path.extname(file.path);
  const hash = createHash('sha256').update(file.contents).digest('hex').slice(0, 10);
  const name = `app.${hash}${ext}`;
  names[ext] = name;
  await writeFile(path.join(dist, 'assets', name), file.contents);
}

await cp(path.join(root, 'public'), dist, { recursive: true });

const version = createHash('sha256').update(JSON.stringify(names)).digest('hex').slice(0, 10);
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace('%APP_JS%', `./assets/${names['.js']}`).replace('%APP_CSS%', `./assets/${names['.css']}`);
await writeFile(path.join(dist, 'index.html'), html);

let sw = await readFile(path.join(root, 'public', 'sw.js'), 'utf8');
sw = sw.replace('%VERSION%', version).replace('%APP_JS%', `./assets/${names['.js']}`).replace('%APP_CSS%', `./assets/${names['.css']}`);
await writeFile(path.join(dist, 'sw.js'), sw);

console.log(`dist listo · versión ${version}`);
