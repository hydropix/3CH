// Drive a running 3CH window over the Chrome DevTools Protocol.
// The app must be started with --remote-debugging-port (see SKILL.md).
//
//   node drive.mjs wait                 wait until the page is loaded
//   node drive.mjs eval "<js>"          evaluate in the page, print the result as JSON
//   node drive.mjs click "<selector>"   click an element
//   node drive.mjs key <key>            press a key (Space, Enter, t, m, 1, ArrowRight, Escape...)
//   node drive.mjs shot <file.png>      save a screenshot of the window
//   node drive.mjs quit                 close the app
//
// CDP_PORT picks the port (default 9222). Needs Node 22+ (global WebSocket).
import { writeFileSync } from 'node:fs';

const port = process.env.CDP_PORT || 9222;
const [cmd, arg] = process.argv.slice(2);

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return res.json();
}

async function pageTarget(timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const page = (await targets()).find((t) => t.type === 'page' && t.url.endsWith('index.html'));
      if (page) return page;
    } catch {}
    if (Date.now() > end) throw new Error(`No 3CH page on port ${port}. Is the app running with --remote-debugging-port=${port}?`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ send, close: () => ws.close() });
    ws.onerror = () => reject(new Error(`Cannot connect to ${wsUrl}`));
  });
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

// The app reads e.key and e.code (Space, Digit1-9), so send both.
function keyEvent(name) {
  if (name === 'Space') return { key: ' ', code: 'Space', text: ' ' };
  if (/^[a-z]$/i.test(name)) return { key: name, code: `Key${name.toUpperCase()}`, text: name };
  if (/^[0-9]$/.test(name)) return { key: name, code: `Digit${name}`, text: name };
  return { key: name, code: name, text: name === 'Enter' ? '\r' : undefined };
}

async function main() {
  const page = await pageTarget();
  if (cmd === 'wait') {
    const cdp = await connect(page.webSocketDebuggerUrl);
    const end = Date.now() + 15000;
    while ((await evaluate(cdp, 'document.readyState')) !== 'complete') {
      if (Date.now() > end) throw new Error('Page did not finish loading');
      await new Promise((r) => setTimeout(r, 200));
    }
    cdp.close();
    return console.log(`ready: ${page.url}`);
  }
  if (cmd === 'quit') {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const cdp = await connect(webSocketDebuggerUrl);
    await cdp.send('Browser.close').catch(() => {});
    return console.log('closed');
  }

  const cdp = await connect(page.webSocketDebuggerUrl);
  try {
    if (cmd === 'eval') {
      console.log(JSON.stringify(await evaluate(cdp, arg), null, 2));
    } else if (cmd === 'click') {
      const ok = await evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(arg)}); if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`No element matches ${arg}`);
      console.log(`clicked ${arg}`);
    } else if (cmd === 'key') {
      const { key, code, text } = keyEvent(arg);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      console.log(`pressed ${arg}`);
    } else if (cmd === 'shot') {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(arg || 'screenshot.png', Buffer.from(data, 'base64'));
      console.log(`saved ${arg || 'screenshot.png'}`);
    } else {
      throw new Error(`Unknown command: ${cmd}`);
    }
  } finally {
    cdp.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
