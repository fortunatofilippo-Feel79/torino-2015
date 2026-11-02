import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const REPO = fileURLToPath(new URL('..', import.meta.url));
const FONTS = fileURLToPath(new URL('./node_modules/@fontsource', import.meta.url));
export const BASE = 'https://fortunatofilippo-feel79.github.io/torino-2015/';
export async function avvia(db) {
  const browser = await chromium.launch();
  const errori = [];
  async function contesto(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', ...opts });
    await ctx.route(BASE + '**', async r => {
      const u = new URL(r.request().url()); let f = u.pathname.replace('/torino-2015/', '') || 'index.html';
      if (f.includes('..')) return r.fulfill({ status: 404, body: 'no' });
      const p = path.join(REPO, f);
      if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: 'no' });
      r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : 'application/javascript', body: fs.readFileSync(p) });
    });
    await ctx.route('https://wsedwqqqagmfuciuxiix.supabase.co/rest/v1/rpc/*', async r => {
      const fn = r.request().url().split('/rpc/')[1];
      const args = JSON.parse(r.request().postData() || '{}');
      const keys = Object.keys(args);
      try {
        const res = await db.query(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) as r`, keys.map(k => { const v = args[k]; return (v && typeof v === 'object') ? JSON.stringify(v) : v; }));
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res.rows[0].r) });
      } catch (e) { errori.push('SQL ' + fn + ': ' + e.message); r.fulfill({ status: 400, body: JSON.stringify({ message: e.message }) }); }
    });
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body:
      `@font-face{font-family:'Lilita One';font-weight:400;src:url(https://fonts.gstatic.com/l.woff2) format('woff2');}` +
      [600,700,800,900].map(w => `@font-face{font-family:'Nunito';font-weight:${w};src:url(https://fonts.gstatic.com/n${w}.woff2) format('woff2');}`).join('') }));
    await ctx.route('https://fonts.gstatic.com/**', r => {
      const n = r.request().url().split('/').pop();
      const f = n === 'l.woff2' ? `${FONTS}/lilita-one/files/lilita-one-latin-400-normal.woff2` : `${FONTS}/nunito/files/nunito-latin-${n.slice(1, 4)}-normal.woff2`;
      r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errori.push('PAGE ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errori.push('CONSOLE ' + m.text()); });
    page.on('dialog', d => d.accept());
    return { ctx, page };
  }
  return { browser, contesto, errori };
}
