import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { demoBundle } from '../scripts/build-chat-demo.mjs';

test('browser demo uses current approved text without network or storage APIs', () => {
  const source = readFileSync(new URL('../chat/demo.js', import.meta.url), 'utf8');
  assert.equal(source.replaceAll('\r\n', '\n'), demoBundle().replaceAll('\r\n', '\n'));
  const context = vm.createContext({ window: {} }); // No fetch, cookies, or storage available.
  vm.runInContext(source, context);
  const reply = context.window.PepcisionChatDemo.reply;
  assert.match(reply('Shipping').answer, /Tampa/);
  assert.equal(reply('How much should I inject?').action, 'refused');
  assert.equal(reply('Shipping and dosage').action, 'refused');
  assert.equal(reply('person@example.com').action, 'sensitive');
  assert.equal(reply('Make up a new product claim').action, 'escalated');
  assert.match(reply('hi').answer, /demo/);
  assert.throws(() => reply('x'.repeat(1001)));
});

test('every public widget explicitly selects demo mode and loads the local bundle first', () => {
  const root = new URL('../', import.meta.url);
  const files = [...readdirSync(root).filter(x => x.endsWith('.html')), ...readdirSync(new URL('products/', root)).map(x => `products/${x}`)];
  let count = 0;
  for (const file of files) {
    const text = readFileSync(new URL(file, root), 'utf8');
    if (!text.includes('chat/widget.js')) continue;
    assert.match(text, /src="(?:\.\.\/)?chat\/widget.js" data-mode="demo" defer/);
    assert(text.indexOf('chat/demo.js') < text.indexOf('chat/widget.js'));
    count++;
  }
  assert.equal(count, 12);
});
