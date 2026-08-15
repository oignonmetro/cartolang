import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const DEPS = '/tmp/claude-0/-home-user-cartolang/1e789774-84ab-5341-a7fb-490054ba62fa/scratchpad/dcdeps/node_modules';
const MAP = {
  'react@18.3.1/umd/react.production.min.js': `${DEPS}/react/umd/react.production.min.js`,
  'react-dom@18.3.1/umd/react-dom.production.min.js': `${DEPS}/react-dom/umd/react-dom.production.min.js`,
  '@babel/standalone@7.29.0/babel.min.js': `${DEPS}/@babel/standalone/babel.min.js`,
};

const b = await chromium.launch({ executablePath: process.env.DS_CHROMIUM_PATH });
const p = await b.newPage({ viewport: { width: 400, height: 900 } });

await p.route('https://unpkg.com/**', (route) => {
  const url = route.request().url().replace('https://unpkg.com/', '');
  const local = MAP[url];
  if (!local) return route.abort();
  route.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(local) });
});

p.on('pageerror', (e) => console.log('[err]', String(e).split('\n')[0]));
await p.goto('http://localhost:5199/Mots%20Difficiles.dc.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
await p.screenshot({ path: '/tmp/agent.png', fullPage: true });
console.log('hauteur', await p.evaluate(() => document.body.scrollHeight));
await b.close();
