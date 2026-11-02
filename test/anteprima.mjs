// Anteprima dei disegni senza database: utile mentre si disegna il Fighter.
// Uso: npm run anteprima → test/shots/anteprima-fighter.png (sei Fighter diversi e le loro miniature).
// Con un'espressione JavaScript che restituisce HTML disegna anche quella in test/shots/anteprima-extra.png, es.:
//   node anteprima.mjs '`<div class="disegno">${disegno("slalom", "sfida")}</div>`'
import { avvia, BASE } from './browser.mjs';
import fs from 'fs';
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const { browser, contesto, errori } = await avvia({ query: async () => { throw new Error('niente database'); } });
const { page } = await contesto();
await page.goto(BASE + 'gioco.html');
await page.waitForSelector('#codiceInvito');
await page.evaluate(() => document.fonts.ready);
const pezzi = await page.evaluate(() => {
  const av = [
    { pelle:2, capelli:'ciuffo', colore:4, occhi:'grinta' },
    { pelle:4, capelli:'ricci', colore:0, occhi:'felici', maglia:'trasferta', scarpe:'rosse' },
    { pelle:0, capelli:'cresta', colore:5, occhi:'normali', maglia:'portiere', acc:'fascetta' },
    { pelle:3, capelli:'rasati', colore:0, occhi:'tranquilli', maglia:'terza', scarpe:'blu', acc:'polsini' },
    { pelle:1, capelli:'lunghi', colore:3, occhi:'furbo', maglia:'storica', scarpe:'oro' },
    { pelle:5, capelli:'corti', colore:0, occhi:'urlo', maglia:'leggenda', scarpe:'bianche' }
  ];
  const fig = av.map((a, i) => `<div style="background:#7a241f;border:3px solid #1E0B0A;border-radius:16px;padding:6px">${fighterSVG(a, { numero: [10, 9, 1, 4, 5, 11][i] })}</div>`).join('');
  const mini = av.map(a => `<div class="mini g">${fighterSVG(a, { busto:true })}</div>`).join('');
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px">${fig}</div><div class="riga wrap" style="padding:8px">${mini}</div>`;
});
await page.evaluate(h => { document.getElementById('app').innerHTML = h; }, pezzi);
await page.screenshot({ path: new URL('./shots/anteprima-fighter.png', import.meta.url).pathname, fullPage: true });
if (typeof process.argv[2] === 'string') {
  const html = await page.evaluate(arg => eval(arg), process.argv[2]);
  await page.evaluate(h => { document.getElementById('app').innerHTML = h; }, html);
  await page.screenshot({ path: new URL('./shots/anteprima-extra.png', import.meta.url).pathname, fullPage: true });
}
console.log('ERRORI:', errori.length ? errori.join('\n') : 'nessuno');
await browser.close();
