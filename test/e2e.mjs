// Collaudo dell'app del gioco su un telefono simulato (390x844), con un Supabase finto
// che esegue le vere funzioni SQL su PGlite. Le schermate finiscono in test/shots/.
import fs from 'fs';
const _log = console.log;
console.log = (...a) => { if (String(a[0]).startsWith('FALLITO')) process.exitCode = 1; _log(...a); };
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
import { nuovoDb } from './db.mjs';
import { avvia, BASE } from './browser.mjs';
const db = await nuovoDb();
const { browser, contesto, errori } = await avvia(db);
const shot = async (page, n) => { await page.waitForTimeout(250); await page.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname, fullPage: false }); console.log('foto', n); };
// chiude le feste a schermo intero (una dopo l'altra), con una foto per ciascuna se serve
const feste = async (page, nome) => { let i = 0; while (await page.$('.festa .btn')) { if (nome) await shot(page, `${nome}${String.fromCharCode(97 + i)}`); i++; await page.click('.festa .btn'); await page.waitForTimeout(350); } return i; };
// conta gli oscillatori creati: se un suono parte davvero, il numero sale
const spia = page => page.evaluate(() => { window.__osc = 0; window.__suoni = []; const o = BaseAudioContext.prototype.createOscillator; BaseAudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); };
  const s = SUONI.suona; SUONI.suona = (n, a) => { window.__suoni.push(n); return s(n, a); }; });
const full = async (page, n) => { await page.waitForTimeout(250); await page.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname, fullPage: true }); console.log('foto', n); };
// 1. dirigente: accesso e attivazione
const D = await contesto();
await D.page.goto(BASE + 'gioco.html?s=2015&staff=1');
await D.page.fill('#chiaveStaff', 'pwd-dirigente');
await D.page.click('[data-act=login]');
await D.page.waitForSelector('[data-act=attiva]');
await shot(D.page, '01-attiva');
await D.page.click('[data-act=attiva]');
await D.page.waitForSelector('#riepilogo');
const cod = (await db.query(`select codice_invito, codice_mister from public.gioco_squadre`)).rows[0];
// 2. ragazzo: iscrizione
const K = await contesto();
await K.page.goto(BASE + `gioco.html?s=2015&i=${cod.codice_invito}`);
await K.page.waitForSelector('#pin1');
await shot(K.page, '02-iscr-genitore');
await K.page.fill('#pin1', '1234'); await K.page.fill('#pin2', '1234');
await K.page.click('[data-act=iscrPin]');
await K.page.waitForSelector('[data-act=iscrNome]');
await K.page.click('[data-act=iscrNome][data-id=r1]');
await shot(K.page, '03-iscr-nome');
await K.page.click('[data-act=iscrAvanti1]');
await K.page.waitForSelector('#anteprima');
await K.page.click('[data-act=av][data-t=capelli][data-k=ciuffo]');
await K.page.click('[data-act=av][data-t=colore][data-k="4"]');
await K.page.click('[data-act=av][data-t=occhi][data-k=grinta]');
await K.page.click('[data-act=av][data-t=pelle][data-k="2"]');
await shot(K.page, '04-iscr-avatar');
await K.page.click('[data-act=iscrAvanti2]');
await K.page.fill('#soprannome', 'Lucky'); await K.page.fill('#numero', '10');
await K.page.click('[data-act=iscrFine]');
await K.page.waitForSelector('text=Quasi fatto');
await shot(K.page, '05-attesa');
// approvazione mentre la pagina è aperta: deve entrare da sola entro 15 secondi
{ const idL = (await db.query(`select id from public.gioco_giocatori where soprannome='Lucky'`)).rows[0].id;
  await db.query(`update public.gioco_giocatori set stato='attivo', approvato=now() where id=$1`, [idL]);
  await K.page.waitForSelector('.eroe .grado', { timeout: 20000 }); console.log('ok - il ragazzo in attesa entra da solo dopo l\'approvazione');
  await db.query(`update public.gioco_giocatori set stato='attesa', approvato=null where id=$1`, [idL]); }
console.log('url dopo iscrizione:', K.page.url().replace(/t=[0-9a-f]+/, 't=…'));
// altri ragazzi direttamente via funzione (stessa strada dell'app)
const altri = [['r2','Bomber',9,{pelle:4,capelli:'ricci',colore:0,occhi:'felici'}],['r3','Tommi',7,{pelle:0,capelli:'cresta',colore:5,occhi:'normali',maglia:'portiere'}],['r4','Ale',4,{pelle:3,capelli:'rasati',colore:0,occhi:'tranquilli'}],['r5','Dado',5,{pelle:1,capelli:'lunghi',colore:3,occhi:'grinta'}],['r6','Nico',11,{pelle:5,capelli:'corti',colore:0,occhi:'felici'}],['r7','Edo',8,{pelle:2,capelli:'ciuffo',colore:6,occhi:'normali'}]];
const tok = {};
for (const [rid, s, n, av] of altri) { const r = (await db.query(`select public.gioco_iscrivi($1,$2,$3,null,$4,$5,$6,'1234') r`, ['2015', cod.codice_invito, rid, s, n, JSON.stringify(av)])).rows[0].r; tok[s] = r.token; }
// 3. dirigente approva
await D.page.reload(); await D.page.waitForSelector('[data-act=stab]');
await D.page.click('[data-act=stab][data-k=squadra]');
await D.page.waitForSelector('[data-act=approva]');
await shot(D.page, '06-dir-approva');
for (let i = 0; i < 7; i++) { const b = await D.page.$('[data-act=approva]'); if (!b) break; await b.click(); await D.page.waitForTimeout(150); }
// il ragazzo in attesa passa dentro da solo (forzo il ricaricamento)
await K.page.reload(); await K.page.waitForSelector('.eroe');
await shot(K.page, '07-ragazzo-home');
// 4. mister dà stelle e mosse
const M = await contesto();
await M.page.goto(BASE + `gioco.html?s=2015&m=${cod.codice_mister}`);
await M.page.waitForSelector('[data-act=stelleDi]');
await shot(M.page, '08-mister-stelle');
const idLucky = (await db.query(`select id from public.gioco_giocatori where soprannome='Lucky'`)).rows[0].id;
await spia(M.page);
await M.page.click(`[data-act=stelleDi][data-id="${idLucky}"]`);
await M.page.waitForSelector('[data-act=daiStella]');
await shot(M.page, '09-mister-foglio');
await M.page.click(`[data-act=daiStella][data-id="${idLucky}"][data-a=coraggio][data-f="0"]`);
await M.page.waitForTimeout(300);
await shot(M.page, '10-mister-toast');
await M.page.click(`[data-act=stelleDi][data-id="${idLucky}"]`);
await M.page.click(`[data-act=daiStella][data-id="${idLucky}"][data-a=squadra][data-f="1"]`);
await M.page.waitForTimeout(200);
console.log((await M.page.evaluate(() => window.__osc)) === 0 ? 'ok - il mister non sente suoni' : 'FALLITO suoni nell\'app del mister');
await M.page.click('[data-act=stab][data-k=mosse]');
await M.page.click(`[data-act=mosseDi][data-id="${idLucky}"]`);
await M.page.click(`[data-act=sbloccaMossa][data-id="${idLucky}"][data-k=doppio]`);
await M.page.waitForTimeout(300);
await shot(M.page, '11-mister-mosse');
await M.page.click('[data-act=chiudi]');
await M.page.click('[data-act=stab][data-k=combine]');
await M.page.waitForSelector('[data-act=salvaCombine]');
await M.page.fill(`#cv-${idLucky}`, '4,12'); await M.page.click(`[data-act=salvaCombine][data-id="${idLucky}"]`); await M.page.waitForTimeout(200);
await shot(M.page, '12-mister-combine');
await M.page.click('[data-act=combProva][data-k=palleggi]'); await M.page.waitForTimeout(150);
await shot(M.page, '12b-mister-combine-palleggi');
// storia passata per Lucky: settimane precedenti con stelle e sfide (per vedere sblocchi)
await db.exec(`
  insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
  select '2015', '${idLucky}', 'stella', jsonb_build_object('area', (array['impegno','coraggio','rispetto','squadra'])[1+(g%4)], 'frase', g%5), 'mister',
         public.gioco_settimana(now() - (g || ' weeks')::interval), public.gioco_mese(now() - (g || ' weeks')::interval), now() - (g || ' weeks')::interval
  from generate_series(1,7) g;
  insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
  select '2015', '${idLucky}', 'sfida', jsonb_build_object('sfida','palleggi','valore', 10+g*3), 'genitore',
         public.gioco_settimana(now() - (g || ' weeks')::interval), public.gioco_mese(now() - (g || ' weeks')::interval), now() - (g || ' weeks')::interval - interval '1 day'
  from generate_series(1,6) g;
  insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
  select '2015', '${idLucky}', 'mossa', jsonb_build_object('mossa', m), 'mister', public.gioco_settimana(now() - interval '3 weeks'), public.gioco_mese(now() - interval '3 weeks'), now() - interval '3 weeks'
  from unnest(array['finta','stop','suola']) m;
`);
// compagni con qualche evento: sfide e stelle (per trio e boss)
for (const s of ['Bomber','Tommi','Ale','Dado']) await db.query(`select public.gioco_ragazzo($1,'sfida',$2)`, [tok[s], JSON.stringify({ sfida:'muro_f', valore:'15', pin:'1234' })]);
// 5. il ragazzo riapre: novità
await K.page.reload(); await K.page.waitForSelector('.festa');
await spia(K.page);
{ const n = await feste(K.page, '13-ragazzo-novita-');
  console.log(n === 3 ? 'ok - all\'apertura: Vediamo, nuovo grado, sbloccato' : 'FALLITO feste all\'apertura: ' + n);
  await K.page.waitForTimeout(2600);
  const r = await K.page.evaluate(() => ({ num: document.getElementById('numT').textContent, veri: S.c.trofei, suoni: window.__suoni, osc: window.__osc }));
  console.log(r.num === String(r.veri) ? 'ok - il contatore arriva ai trofei veri (' + r.num + ')' : 'FALLITO contatore ' + r.num + ' invece di ' + r.veri);
  console.log(r.suoni.includes('grado') && r.suoni.includes('fanfara') && r.suoni.includes('moneta') && r.osc > 20 ? 'ok - suoni di grado, sblocco e monete partiti davvero (' + r.osc + ' oscillatori)' : 'FALLITO suoni all\'apertura ' + JSON.stringify(r)); }
await full(K.page, '14-ragazzo-fighter');
await K.page.click('[data-act=salta]'); await K.page.waitForTimeout(220);
await shot(K.page, '14b-fighter-salta');
await K.page.click('[data-act=missione]'); await K.page.waitForSelector('.foglio h2');
await shot(K.page, '14c-missione');
await K.page.click('[data-act=chiudi]');
// sfide
await K.page.click('[data-act=tab][data-k=sfide]');
await shot(K.page, '15-ragazzo-sfide');
await K.page.click('[data-act=sfida][data-k=muro_d]');
await K.page.waitForSelector('[data-act=timer30]');
await K.page.click('[data-act=timer30]');
await K.page.waitForTimeout(2100);
await shot(K.page, '16-sfida-timer');
await K.page.click('[data-act=timer30]');
await K.page.fill('#valSfida', '12'); await K.page.fill('#pinSfida', '9999');
await K.page.click('[data-act=salvaSfida]'); await K.page.waitForSelector('.foglio .errore');
await shot(K.page, '17-sfida-pin-errato');
await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
await K.page.waitForTimeout(500);
await K.page.click('[data-act=sfida][data-k=palleggi]');
await K.page.fill('#valSfida', '41'); await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
await K.page.waitForSelector('.festa .gigante'); await K.page.waitForTimeout(700);
await shot(K.page, '18-record');
console.log((await K.page.evaluate(() => window.__suoni.includes('record'))) ? 'ok - record: schermata intera e suono' : 'FALLITO suono del record');
await feste(K.page);
await K.page.waitForTimeout(250);
await shot(K.page, '18b-trofei-volano');
await K.page.waitForTimeout(2200);
await K.page.click('[data-act=obiettivo][data-k=debole]'); await K.page.waitForTimeout(300);
await K.page.click('[data-act=autoval][data-k=quasi]'); await K.page.waitForTimeout(300);
await full(K.page, '19-ragazzo-sfide-dopo');
// squadra: gg
await K.page.click('[data-act=tab][data-k=squadra]');
await K.page.waitForTimeout(200);
await full(K.page, '20-ragazzo-squadra');
const g = await K.page.$('[data-act=gg]');
if (g) { await g.click(); await K.page.waitForSelector('[data-act=mandaGG]'); await shot(K.page, '21-gg'); await K.page.click('[data-act=mandaGG][data-f="1"]');
  await K.page.waitForSelector('.danno', { timeout: 5000 }).then(() => console.log('ok - il GG toglie energia al boss: numero del danno e boss che trema')).catch(() => console.log('FALLITO boss colpito dopo il GG'));
  await K.page.evaluate(() => document.querySelector('.boss').scrollIntoView({ block: 'center' })); await K.page.waitForTimeout(150);
  await shot(K.page, '21b-boss-colpito'); await K.page.waitForTimeout(2600); }
// trofei
await K.page.click('[data-act=tab][data-k=strada]');
await full(K.page, '22-ragazzo-trofei');
await K.page.click('[data-act=mossa][data-k=doppio]'); await K.page.waitForSelector('.foglio .disegno animateMotion', { state: 'attached' });
await shot(K.page, '22b-mossa-disegno'); await K.page.click('[data-act=chiudi]');
{ const r = await K.page.evaluate(() => ({ sfide: SFIDE.filter(s => !DIS_SFIDA[s.k]).map(s => s.k), mosse: MOSSE.filter(m => !DIS_MOSSA[m.k]).map(m => m.k) }));
  console.log(!r.sfide.length && !r.mosse.length ? 'ok - ogni sfida e ogni mossa ha il suo disegno' : 'FALLITO disegni mancanti: ' + JSON.stringify(r)); }
// suoni spenti: l'altoparlante in alto li ferma davvero
{ await K.page.click('[data-act=suoni]'); await K.page.waitForTimeout(200);
  const prima = await K.page.evaluate(() => window.__osc);
  await K.page.click('[data-act=tab][data-k=sfide]'); await K.page.click('[data-act=tab][data-k=strada]'); await K.page.waitForTimeout(200);
  const r = await K.page.evaluate(() => ({ osc: window.__osc, ls: localStorage.getItem('ngu:suoni') }));
  console.log(r.osc === prima && r.ls === '0' ? 'ok - con l\'altoparlante spento non parte nessun suono' : 'FALLITO muto ' + JSON.stringify(r) + ' prima ' + prima);
  await shot(K.page, '22c-suoni-spenti');
  await K.page.click('[data-act=suoni]'); await K.page.waitForTimeout(200);
  const r2 = await K.page.evaluate(() => ({ osc: window.__osc, ls: localStorage.getItem('ngu:suoni') }));
  console.log(r2.osc > r.osc && r2.ls === null ? 'ok - riacceso, i suoni ripartono' : 'FALLITO riaccensione ' + JSON.stringify(r2)); }
// personalizza
await K.page.click('[data-act=tab][data-k=fighter]');
await K.page.click('[data-act=personalizza]');
await K.page.waitForSelector('.foglio #anteprima');
await K.page.click('.foglio [data-act=av][data-t=maglia][data-k=trasferta]').catch(() => console.log('trasferta bloccata'));
await K.page.click('.foglio [data-act=av][data-t=sfondo][data-k=stadio]').catch(() => console.log('stadio bloccato'));
await K.page.click('.foglio [data-act=av][data-t=cornice][data-k=bronzo]').catch(() => console.log('bronzo bloccato'));
await K.page.click('.foglio [data-act=av][data-t=scarpe][data-k=rosse]').catch(() => console.log('rosse bloccate'));
await shot(K.page, '23-personalizza');
await K.page.evaluate(() => { document.querySelector('.foglio').scrollTop = 0; }); await shot(K.page, '23b-personalizza-in-alto');
await K.page.click('[data-act=salvaAvatar]'); await K.page.waitForTimeout(500);
await shot(K.page, '24-fighter-nuovo');
// 6. dirigente: riepilogo e immagine
await D.page.reload(); await D.page.waitForSelector('[data-act=stab]');
await D.page.click('[data-act=stab][data-k=squadra]');
await D.page.waitForTimeout(800);
await full(D.page, '25-dir-squadra');
const dataUrl = await D.page.evaluate(() => document.getElementById('riepilogo').toDataURL('image/png'));
(await import('fs')).writeFileSync(new URL('./shots/26-riepilogo-esportato.png', import.meta.url), Buffer.from(dataUrl.split(',')[1], 'base64'));
await D.page.click('[data-act=stab][data-k=stelle]');
await shot(D.page, '27-dir-stelle');
// il dirigente non può dare stelle al figlio
const idTommi = (await db.query(`select id from public.gioco_giocatori where soprannome='Tommi'`)).rows[0].id;
await D.page.click('[data-act=stab][data-k=squadra]'); await D.page.waitForSelector('#figlio');
await D.page.selectOption('#figlio', idTommi); await D.page.click('[data-act=salvaImp]'); await D.page.waitForTimeout(400);
await D.page.click('[data-act=stab][data-k=stelle]');
await D.page.click(`[data-act=stelleDi][data-id="${idTommi}"]`);
await shot(D.page, '28-dir-figlio');
await D.page.click('[data-act=chiudi]');
await D.page.click('[data-act=stab][data-k=squadra]'); await D.page.waitForSelector('[data-act=invitoGenitori]');
await D.page.evaluate(() => { window.__copiato = ''; navigator.clipboard.writeText = t => { window.__copiato = t; return Promise.resolve(); }; });
await D.page.click('[data-act=invitoGenitori]'); await D.page.waitForTimeout(200);
const inv = await D.page.evaluate(() => window.__copiato || (document.querySelector('.foglio textarea') || {}).value || '');
console.log(inv.includes('gioco.html?s=2015&i=') ? 'ok - messaggio genitori con link d\'invito' : 'FALLITO messaggio genitori: ' + inv.slice(0, 80));
await D.page.click('[data-act=invitoMister]'); await D.page.waitForTimeout(200);
const mis = await D.page.evaluate(() => window.__copiato);
console.log(mis.includes('&m=') ? 'ok - messaggio mister con link' : 'FALLITO messaggio mister');
// 7. chi ha "riduci movimento" sul telefono: niente animazioni
{ const R = await contesto({ reducedMotion: 'reduce' });
  await R.page.goto(BASE + `gioco.html?s=2015&t=${tok.Bomber}`); await R.page.waitForSelector('.eroe .corpo');
  await feste(R.page);
  const a = await R.page.evaluate(() => [getComputedStyle(document.querySelector('.eroe .corpo')).animationName, getComputedStyle(document.querySelector('.app > .pan')).animationName]);
  console.log(a.every(x => x === 'none') ? 'ok - con "riduci movimento" il Fighter e le schede stanno fermi' : 'FALLITO riduci movimento: ' + a); }
// 8. i suoni, registrati in file .wav da ascoltare (test/shots/suoni/)
{ const S2 = await contesto();
  await S2.page.goto(BASE + 'gioco.html'); await S2.page.waitForSelector('#codiceInvito');
  const res = await S2.page.evaluate(async () => {
    const wav = (dati, sr) => { const b = new DataView(new ArrayBuffer(44 + dati.length * 2)); const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); b.setUint32(4, 36 + dati.length * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, sr, true); b.setUint32(28, sr * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, dati.length * 2, true);
      dati.forEach((v, i) => b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true)); let s = ''; new Uint8Array(b.buffer).forEach(x => s += String.fromCharCode(x)); return btoa(s); };
    const out = {}, tutti = [], sr = 44100;
    for (const n of SUONI.nomi) {
      const c = new OfflineAudioContext(1, Math.round(sr * 2.6), sr); SUONI.disegna(c, n); const d = (await c.startRendering()).getChannelData(0);
      let picco = 0, fine = 0; d.forEach((v, i) => { const a = Math.abs(v); if (a > picco) picco = a; if (a > .002) fine = i; });
      const pezzo = Array.from(d.slice(0, fine + 2000)); tutti.push(...pezzo, ...new Array(Math.round(sr * .45)).fill(0));
      out[n] = { picco: +picco.toFixed(3), durata: +(fine / sr).toFixed(2), wav: wav(pezzo, sr) };
    }
    out._tutti = { wav: wav(tutti, sr) };
    return out;
  });
  const dir = new URL('./shots/suoni/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
  for (const [n, r] of Object.entries(res)) fs.writeFileSync(new URL(`${n === '_tutti' ? 'tutti-i-suoni' : n}.wav`, dir), Buffer.from(r.wav, 'base64'));
  const male = Object.entries(res).filter(([n, r]) => n !== '_tutti' && (r.picco < .05 || r.picco > .99 || r.durata > 2.5));
  console.log(male.length ? 'FALLITO suoni: ' + JSON.stringify(male.map(([n, r]) => [n, r.picco, r.durata])) : 'ok - ' + (Object.keys(res).length - 1) + ' suoni udibili e senza distorsione: ' + Object.entries(res).filter(([n]) => n !== '_tutti').map(([n, r]) => `${n} ${r.durata}s`).join(', ')); }
// 9. benvenuto senza link
const V = await contesto();
await V.page.goto(BASE + 'gioco.html');
await V.page.waitForSelector('#codiceInvito');
await shot(V.page, '29-benvenuto');
console.log('ERRORI:', errori.length ? errori.join('\n') : 'nessuno');
if (errori.length) process.exitCode = 1;
await browser.close();
