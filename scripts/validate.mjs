import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  ...fs.readdirSync(root).filter(name => name.endsWith('.html')),
  ...fs.readdirSync(path.join(root, 'products')).filter(name => name.endsWith('.html')).map(name => 'products/' + name),
];
let referenceCount = 0;
const ids = new Map(pages.map(file => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  return [file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))];
}));
function checkReference(file, value) {
  if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.includes('${')) return;
  const [rawPath, fragment] = value.split('#');
  const asset = rawPath.split('?')[0];
  const target = asset ? path.resolve(root, path.dirname(file), decodeURIComponent(asset)) : path.resolve(root, file);
  const relative = path.relative(root, target).split(path.sep).join('/');
  assert(!relative.startsWith('../'), file + ': reference escapes site');
  assert(fs.existsSync(target), file + ': missing ' + value);
  if (fragment && ids.has(relative)) assert(ids.get(relative).has(fragment), file + ': missing anchor ' + value);
  referenceCount++;
}
for (const file of pages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) checkReference(file, match[1]);
  assert(!/(?:pat[A-Za-z0-9]{12,}\.[a-f0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/.test(html), file + ': possible credential');
}
for (const file of ['styles.css', 'brand-overrides.css']) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) checkReference(file, match[1]);
}
const data = fs.readFileSync(path.join(root, 'product-data.js'), 'utf8');
let products = 0;
for (const file of pages.filter(name => name.startsWith('products/'))) {
  const nodes = Object.fromEntries([...ids.get(file)].map(id => [id, {}]));
  const context = { window: {}, document: { title: '', getElementById: id => nodes[id] ?? null } };
  vm.createContext(context);
  vm.runInContext(data, context, { timeout: 1000 });
  context.PEPCISION_PRODUCTS = context.window.PEPCISION_PRODUCTS;
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], context, { timeout: 1000 });
  for (const id of ['title', 'pcat', 'summary', 'desc', 'size', 'purity', 'storage']) assert(nodes[id]?.textContent, file + ': empty ' + id);
  products++;
}
let catalog = '';
const homeContext = { window: {}, document: { write: html => { catalog += html; } } };
vm.createContext(homeContext);
vm.runInContext(data, homeContext, { timeout: 1000 });
homeContext.PEPCISION_PRODUCTS = homeContext.window.PEPCISION_PRODUCTS;
for (const script of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], homeContext, { timeout: 1000 });
assert.equal([...catalog.matchAll(/<article /g)].length, products, 'Homepage product count');
for (const match of catalog.matchAll(/(?:src|href)="([^"]+)"/g)) checkReference('index.html', match[1]);
const answer = { hidden: true };
let toggle;
const button = { parentElement: { querySelector: () => answer }, addEventListener: (_, callback) => { toggle = callback; } };
const faqContext = { document: { querySelectorAll: () => [button] } };
vm.createContext(faqContext);
for (const script of fs.readFileSync(path.join(root, 'faq.html'), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], faqContext, { timeout: 1000 });
assert(toggle, 'FAQ click handler missing');
toggle();
assert.equal(answer.hidden, false, 'FAQ did not open');
toggle();
assert.equal(answer.hidden, true, 'FAQ did not close');
console.log('Validated ' + pages.length + ' pages, ' + products + ' product pages, ' + referenceCount + ' local references, homepage catalog, and FAQ toggles.');
