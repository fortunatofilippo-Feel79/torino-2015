// Collaudo dell'app del gioco su un telefono simulato (390x844), con un Supabase finto
// che esegue le vere funzioni SQL su PGlite. Le schermate finiscono in test/shots/.
import fs from 'fs';
const _log = console.log;
console.log = (...a) => { if (String(a[0]).startsWith('FALLITO')) process.exitCode = 1; _log(...a); };
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
import { nuovoDb } from './db.mjs';
import { avvia, BASE } from './browser.mjs';
const db = await nuovoDb();
// il collaudo decide che giorno è (1 lunedì … 7 domenica): in produzione lo dice l'orologio di Roma
const giorno = n => db.exec(`create or replace function public.gioco_giorno(p_ts timestamptz default now()) returns integer language sql stable set search_path = '' as $$ select ${n} $$`);
await giorno(3);
// la sfida della settimana cambia ogni lunedì: il collaudo usa per medaglia e record due sfide diverse da quella
const SETT = (await db.query(`select public.gioco_sfida_settimana(public.gioco_settimana()) k`)).rows[0].k;
const MURO = SETT === 'muro_d' ? 'muro_f' : 'muro_d', REC = SETT === 'palleggi' ? 'suola' : 'palleggi';
const { browser, contesto, errori } = await avvia(db);
const shot = async (page, n) => { await page.waitForTimeout(250); await page.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname, fullPage: false }); console.log('foto', n); };
// chiude le feste una dopo l'altra e dice se tra loro c'era quella cercata (con la sua foto)
const festeFino = async (page, sel, foto) => { let vista = false; await page.waitForSelector('.festa .btn', { timeout: 5000 }).catch(() => {});
  while (await page.$('.festa .btn')) { if (await page.$(sel)) { vista = true; await page.waitForTimeout(650); if (foto) await shot(page, foto); } await page.click('.festa .btn'); await page.waitForTimeout(350); } return vista; };
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
  select '2015', '${idLucky}', 'sfida', jsonb_build_object('sfida','${REC}','valore', 10+g*3), 'genitore',
         public.gioco_settimana(now() - (g || ' weeks')::interval), public.gioco_mese(now() - (g || ' weeks')::interval), now() - (g || ' weeks')::interval - interval '1 day'
  from generate_series(1,6) g;
  insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
  select '2015', '${idLucky}', 'mossa', jsonb_build_object('mossa', m), 'mister', public.gioco_settimana(now() - interval '3 weeks'), public.gioco_mese(now() - interval '3 weeks'), now() - interval '3 weeks'
  from unnest(array['finta','stop','suola']) m;
  insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
  values ('2015', '${idLucky}', 'sfida', jsonb_build_object('sfida','${MURO}','valore', 20), 'genitore',
          public.gioco_settimana(now() - interval '9 days'), public.gioco_mese(now() - interval '9 days'), now() - interval '9 days');
`);
// compagni con qualche evento: sfide e stelle (per trio e boss)
for (const s of ['Bomber','Tommi','Ale','Dado']) await db.query(`select public.gioco_ragazzo($1,'sfida',$2)`, [tok[s], JSON.stringify({ sfida:'muro_f', valore:'15', pin:'1234' })]);
// 5. il ragazzo riapre: novità
await K.page.reload(); await K.page.waitForSelector('.festa');
await spia(K.page);
{ let mossaOk = false, n = 0;
  while (await K.page.$('.festa .btn')) {
    await shot(K.page, `13-ragazzo-novita-${String.fromCharCode(97 + n)}`);
    if (await K.page.$('.festa .campetto')) {   // la festa della mossa nuova: il Fighter la fa da solo
      await K.page.waitForTimeout(1100);
      mossaOk = await K.page.evaluate(() => ['.att', '.pal'].every(q => document.querySelector('.festa .campetto ' + q).getAnimations().some(a => a.id === 'ngu')));
      await shot(K.page, '13-ragazzo-novita-mossa-in-corso');
    }
    n++; await K.page.click('.festa .btn'); await K.page.waitForTimeout(350);
  }
  console.log(n === 4 ? 'ok - all\'apertura: Vediamo, nuovo grado, mossa nuova, sbloccato' : 'FALLITO feste all\'apertura: ' + n);
  console.log(mossaOk ? 'ok - nella festa il Fighter fa la mossa appena sbloccata' : 'FALLITO la mossa nuova non parte nella festa');
  await K.page.waitForTimeout(2600);
  const r = await K.page.evaluate(() => ({ num: document.getElementById('numT').textContent, veri: S.c.trofei, suoni: window.__suoni, osc: window.__osc }));
  console.log(r.num === String(r.veri) ? 'ok - il contatore arriva ai trofei veri (' + r.num + ')' : 'FALLITO contatore ' + r.num + ' invece di ' + r.veri);
  console.log(r.suoni.includes('grado') && r.suoni.includes('fanfara') && r.suoni.includes('moneta') && r.osc > 20 ? 'ok - suoni di grado, sblocco e monete partiti davvero (' + r.osc + ' oscillatori)' : 'FALLITO suoni all\'apertura ' + JSON.stringify(r)); }
await full(K.page, '14-ragazzo-fighter');
{ const t = await K.page.evaluate(() => [...document.querySelectorAll('.trag')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  console.log(t.length >= 2 && t.length <= 4 && /Mancano \d+ trofei/.test(t[0]) ? 'ok - prossimi traguardi: ' + t.join(' | ') : 'FALLITO traguardi: ' + JSON.stringify(t)); }
await K.page.click('[data-act=salta]'); await K.page.waitForTimeout(220);
await shot(K.page, '14b-fighter-salta');
await K.page.click('[data-act=missione]'); await K.page.waitForSelector('.foglio h2');
await shot(K.page, '14c-missione');
await K.page.click('[data-act=chiudi]');
// sfide
await K.page.click('[data-act=tab][data-k=sfide]');
await shot(K.page, '15-ragazzo-sfide');
// sfida della settimana: in evidenza in cima, 5 trofei in più la prima volta
{ const prima = await K.page.evaluate(() => ({ t: S.c.trofei, k: sfidaSettimana(S.io.ora.settimana).k, nuove: document.querySelectorAll('.tessera .badge.nuova').length, attiva: regole4(S.io.ora.settimana) }));
  await K.page.click('.pan.sett'); await K.page.waitForSelector('#valSfida');
  await K.page.fill('#valSfida', '15'); await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
  await K.page.waitForSelector('.pan.sett.fatta'); const avviso = await K.page.evaluate(() => document.getElementById('toast').textContent);
  await feste(K.page); await K.page.waitForTimeout(300);
  const dopo = await K.page.evaluate(() => ({ t: S.c.trofei, nuove: document.querySelectorAll('.tessera .badge.nuova').length }));
  console.log(prima.attiva && prima.k === SETT && dopo.t === prima.t + 10 && avviso.includes('Sfida della settimana fatta') ? `ok - sfida della settimana (${SETT}): 5 + 5 trofei la prima volta` : 'FALLITO sfida della settimana ' + JSON.stringify({ prima, dopo, avviso, SETT }));
  console.log(prima.nuove >= 5 && prima.nuove <= 6 ? `ok - le sfide nuove mai provate hanno l'etichetta «nuova» (${prima.nuove})` : 'FALLITO etichette nuova ' + prima.nuove);
  await K.page.evaluate(() => window.scrollTo(0, 0)); await shot(K.page, '15b-sfida-della-settimana-fatta');
  await K.page.waitForTimeout(2400); }
await K.page.click(`[data-act=sfida][data-k=${MURO}]`);
await K.page.waitForSelector('[data-act=timer30]');
await K.page.click('[data-act=timer30]');
await K.page.waitForTimeout(2100);
await shot(K.page, '16-sfida-timer');
await K.page.click('[data-act=timer30]');
await K.page.fill('#valSfida', '12'); await K.page.fill('#pinSfida', '9999');
await K.page.click('[data-act=salvaSfida]'); await K.page.waitForSelector('.foglio .errore');
await shot(K.page, '17-sfida-pin-errato');
await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
console.log(await festeFino(K.page, '.festa .medagliona', '17b-medaglia') ? 'ok - secondo giorno della stessa sfida: festa della medaglia di bronzo' : 'FALLITO festa della medaglia');
await K.page.waitForTimeout(2400);
{ const r = await K.page.evaluate(([MURO, REC]) => ({ tessere: document.querySelectorAll('.tessera .med').length, muro: S.c.medaglie[MURO], rec: S.c.medaglie[REC], giorni: S.c.giorni[REC] }), [MURO, REC]);
  console.log(r.tessere === 12 && r.muro === 1 && r.rec === 2 && r.giorni === 6 ? `ok - medaglie sulle 12 tessere: ${MURO} bronzo, ${REC} argento (6 giorni)` : 'FALLITO medaglie ' + JSON.stringify(r)); }
await K.page.click(`[data-act=sfida][data-k=${REC}]`);
await K.page.waitForSelector('.foglio .grafico polyline');
{ const r = await K.page.evaluate(() => ({ prese: document.querySelectorAll('.foglio .medaglie .presa').length, punti: document.querySelectorAll('.foglio .grafico circle').length }));
  console.log(r.prese === 2 && r.punti === 6 ? 'ok - nel foglio della sfida: due medaglie prese e grafico con i 6 risultati' : 'FALLITO foglio sfida ' + JSON.stringify(r));
  await K.page.evaluate(() => { const f = document.querySelector('.foglio'); f.scrollTop = f.scrollHeight; }); await shot(K.page, '17c-sfida-medaglie-grafico');
  await K.page.evaluate(() => { document.querySelector('.foglio').scrollTop = 0; }); }
// terza sfida della settimana, con record: è nelle prime tre, quindi il record vale ancora 5 trofei
await K.page.fill('#valSfida', '41'); await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
await K.page.waitForSelector('.festa .gigante'); await K.page.waitForTimeout(700);
await shot(K.page, '18-record');
console.log((await K.page.evaluate(() => window.__suoni.includes('record'))) ? 'ok - record: schermata intera e suono' : 'FALLITO suono del record');
await feste(K.page);
await K.page.waitForTimeout(250);
await shot(K.page, '18b-trofei-volano');
await K.page.waitForTimeout(2200);
// quarta sfida della settimana con un altro record: festa sì, trofei no (regole nuove)
{ const prima = await K.page.evaluate(() => S.c.trofei);
  await K.page.click(`[data-act=sfida][data-k=${REC}]`); await K.page.waitForSelector('#valSfida');
  await K.page.fill('#valSfida', '45'); await K.page.fill('#pinSfida', '1234'); await K.page.click('[data-act=salvaSfida]');
  await K.page.waitForSelector('.festa .gigante'); const conTrofei = !!(await K.page.$('.festa .guadagno')); await feste(K.page); await K.page.waitForTimeout(600);
  const dopo = await K.page.evaluate(([REC]) => ({ t: S.c.trofei, rec: S.c.record[REC] }), [REC]);
  console.log(dopo.t === prima && dopo.rec === 45 && !conTrofei ? 'ok - record oltre le prime tre sfide della settimana: il record resta, i trofei no' : 'FALLITO record oltre le tre: ' + JSON.stringify({ prima, dopo, conTrofei })); }
// obiettivo: di mercoledì si sceglie ma non si può ancora dire com'è andata
await K.page.click('[data-act=obiettivo][data-k=debole]'); await K.page.waitForSelector('.aspetta');
{ const r = await K.page.evaluate(() => ({ testo: document.querySelector('.aspetta').textContent, tasti: document.querySelectorAll('[data-act=autoval]').length }));
  console.log(r.tasti === 0 && r.testo.includes('Da venerdì') ? 'ok - obiettivo scelto di mercoledì: «Da venerdì torna qui», nessun tasto' : 'FALLITO obiettivo di mercoledì ' + JSON.stringify(r));
  await K.page.evaluate(() => document.querySelector('.aspetta').scrollIntoView({ block: 'center' })); await shot(K.page, '19a-obiettivo-aspetta'); }
// venerdì, ma l'obiettivo è stato scelto oggi: ancora no
await giorno(5); await K.page.reload(); await K.page.waitForSelector('.eroe'); await feste(K.page);
await K.page.click('[data-act=tab][data-k=sfide]'); await K.page.waitForSelector('.aspetta');
{ const r = await K.page.evaluate(() => ({ testo: document.querySelector('.aspetta').textContent, tasti: document.querySelectorAll('[data-act=autoval]').length }));
  const sql = (await db.query(`select public.gioco_ragazzo($1, 'autovalutazione', '{"esito":"fatto"}') r`, [new URL(K.page.url()).searchParams.get('t')])).rows[0].r;
  console.log(r.tasti === 0 && r.testo.includes('scelto oggi') && sql.errore === 'oggi' ? 'ok - venerdì con obiettivo scelto oggi: né l\'app né il database lasciano autovalutarsi' : 'FALLITO obiettivo scelto oggi ' + JSON.stringify(r) + JSON.stringify(sql)); }
// venerdì, obiettivo scelto ieri: adesso sì
await db.query(`update public.gioco_eventi set creato = creato - interval '1 day' where giocatore = $1 and tipo = 'obiettivo'`, [idLucky]);
await K.page.reload(); await K.page.waitForSelector('.eroe'); await feste(K.page);
{ const t = await K.page.evaluate(() => [...document.querySelectorAll('.trag')].map(b => b.textContent).join(' | '));
  console.log(t.includes('andato il tuo obiettivo') ? 'ok - da venerdì tra i traguardi c\'è «Com\'è andato il tuo obiettivo?»' : 'FALLITO traguardo dell\'obiettivo: ' + t); }
await K.page.click('[data-act=tab][data-k=sfide]'); await K.page.waitForSelector('[data-act=autoval]');
{ const prima = await K.page.evaluate(() => S.c.trofei);
  await K.page.click('[data-act=autoval][data-k=quasi]'); await K.page.waitForTimeout(400);
  console.log((await K.page.evaluate(() => S.c.trofei)) === prima + 5 ? 'ok - autovalutazione di venerdì: 5 trofei' : 'FALLITO autovalutazione'); }
await spia(K.page);
await full(K.page, '19-ragazzo-sfide-dopo');
// squadra: gg
await K.page.click('[data-act=tab][data-k=squadra]');
await K.page.waitForTimeout(200);
await full(K.page, '20-ragazzo-squadra');
{ const mese = (await db.query(`select public.gioco_mese() m`)).rows[0].m;
  const sql = (await db.query(`select trofei from public.gioco_danni('2015', $1) where giocatore = $2`, [mese, idLucky])).rows[0];
  const r = await K.page.evaluate(() => ({ miei: mieiDanni(S.io), fase: (document.querySelector('.boss .fase') || {}).textContent, tuo: (document.querySelector('.boss .tuo') || {}).textContent, tacche: document.querySelectorAll('.energia b').length }));
  console.log(sql && r.miei === sql.trofei && r.tuo.includes(String(r.miei)) && r.fase && r.tacche === 3 ? `ok - boss: fase «${r.fase}», il tuo contributo (${r.miei}) è uguale al conto del database` : 'FALLITO boss ' + JSON.stringify(r) + ' sql ' + JSON.stringify(sql)); }
// missione di fantasquadra: barra dei passi, chi ha dato una mano, nessun numero a testa
const gruppo = (await db.query(`select t2.giocatore id, x.soprannome s from public.gioco_trii t1
  join public.gioco_trii t2 on t2.squadra = t1.squadra and t2.settimana = t1.settimana and t2.gruppo = t1.gruppo
  join public.gioco_giocatori x on x.id = t2.giocatore where t1.giocatore = $1 and t1.settimana = public.gioco_settimana()`, [idLucky])).rows;
const passiVeri = async () => { let n = 0; for (const r of (await db.query(`select tipo, giocatore, count(*) c from public.gioco_eventi
  where settimana = public.gioco_settimana() and tipo in ('sfida', 'stella', 'gg') and giocatore = any($1::uuid[]) group by 1, 2`, [gruppo.map(x => x.id)])).rows) n += r.tipo === 'sfida' ? Math.min(3, Number(r.c)) : Number(r.c); return n; };
const passiPrima = await passiVeri();
{ const r = await K.page.evaluate(() => ({ barra: document.querySelector('.fanta .passi span').textContent, M: S.io.missione, numeri: S.io.trio.some(t => 'passi' in t || 'totale' in t),
    righe: [...document.querySelectorAll('.fanta .voce:not(.tifo) div.piccolo')].map(x => x.textContent.trim()) }));
  console.log(gruppo.length >= 2 && r.M.passi === passiPrima && r.M.traguardo === 4 * gruppo.length && r.barra === `${passiPrima} passi su ${4 * gruppo.length}` && !r.numeri && r.righe.length === gruppo.length && r.righe.every(t => /dato una mano|non ancora|primo passo/.test(t))
    ? `ok - missione di fantasquadra: ${r.barra}, per ogni compagno solo «ha dato una mano» o «non ancora» (${r.righe.join(' · ')})` : 'FALLITO missione ' + JSON.stringify(r) + ' veri ' + passiPrima + ' gruppo ' + gruppo.length); }
const g = await K.page.$('[data-act=gg]');
if (g) { await g.click(); await K.page.waitForSelector('[data-act=mandaGG]'); await shot(K.page, '21-gg'); await K.page.click('[data-act=mandaGG][data-f="1"]');
  await K.page.waitForSelector('.danno', { timeout: 5000 }).then(() => console.log('ok - il GG toglie energia al boss: numero del danno e boss che trema')).catch(() => console.log('FALLITO boss colpito dopo il GG'));
  await K.page.evaluate(() => document.querySelector('.boss').scrollIntoView({ block: 'center' })); await K.page.waitForTimeout(150);
  await shot(K.page, '21b-boss-colpito'); await K.page.waitForTimeout(2600);
  const p = await K.page.evaluate(() => S.io.missione.passi);
  console.log(p === passiPrima + 1 && p === await passiVeri() ? 'ok - il GG mandato è un passo della fantasquadra' : 'FALLITO passo del GG: ' + passiPrima + ' → ' + p); }
// tifo: una frase pronta a tutta la fantasquadra, non è un passo
{ const prima = await K.page.evaluate(() => S.io.missione.passi);
  await K.page.click('[data-act=tifo]'); await K.page.waitForSelector('[data-act=mandaTifo]'); await shot(K.page, '21c-tifo-frasi');
  const frasi = await K.page.evaluate(() => ({ n: document.querySelectorAll('[data-act=mandaTifo]').length, campi: document.querySelectorAll('.foglio input, .foglio textarea').length }));
  await K.page.click('[data-act=mandaTifo][data-f="0"]'); await K.page.waitForSelector('.voce.tifo');
  const r = await K.page.evaluate(() => ({ t: document.querySelector('.voce.tifo').textContent, passi: S.io.missione.passi }));
  console.log(frasi.n === 6 && frasi.campi === 0 && r.t.includes('Tu') && r.t.includes('Dai che ci siamo!') && r.passi === prima ? 'ok - tifo: sei frasi pronte, nessun campo da scrivere; compare nella fantasquadra e non è un passo' : 'FALLITO tifo ' + JSON.stringify({ frasi, r, prima }));
  // un compagno fa il tifo: alla prossima apertura è tra le novità
  const amico = gruppo.find(x => x.id !== idLucky);
  await db.query(`select public.gioco_ragazzo($1, 'tifo', '{"frase":1}')`, [tok[amico.s]]);
  await K.page.reload(); await K.page.waitForSelector('.festa'); let visto = false;
  while (await K.page.$('.festa .btn')) { if ((await K.page.evaluate(() => document.querySelector('.festa .scatola').textContent)).includes(amico.s + ' fa il tifo: Grande squadra!')) { visto = true; await shot(K.page, '21d-novita-tifo'); } await K.page.click('.festa .btn'); await K.page.waitForTimeout(350); }
  console.log(visto ? 'ok - il tifo di un compagno arriva tra le novità all\'apertura' : 'FALLITO tifo ricevuto');
  // i compagni fanno i passi che mancano: missione compiuta, 10 trofei a chi ha dato una mano
  const st = await K.page.evaluate(() => ({ t: S.c.trofei, M: S.io.missione }));
  await db.query(`insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    select '2015', $1, 'gg', jsonb_build_object('a', $2::text, 'frase', 0), 'ragazzo', public.gioco_settimana(), public.gioco_mese() from generate_series(1, $3::integer)`, [amico.id, idLucky, st.M.traguardo - st.M.passi]);
  await K.page.reload(); await K.page.waitForSelector('.festa'); visto = false;
  while (await K.page.$('.festa .btn')) { if ((await K.page.evaluate(() => document.querySelector('.festa .scatola').textContent)).includes('Missione compiuta!')) { visto = true; await K.page.waitForTimeout(600); await shot(K.page, '21e-missione-compiuta'); } await K.page.click('.festa .btn'); await K.page.waitForTimeout(350); }
  await K.page.click('[data-act=tab][data-k=squadra]'); await K.page.waitForSelector('.fanta .passi.fatta');
  const dopo = await K.page.evaluate(() => ({ t: S.c.trofei, M: S.io.missione, trag: 0 }));
  // i GG ricevuti valgono 3 trofei l'uno: i 10 della missione si contano a parte
  const gg = (st.M.traguardo - st.M.passi) * 3;
  console.log(visto && dopo.M.compiuta && dopo.t === st.t + 10 + gg ? 'ok - missione compiuta: festa all\'apertura e 10 trofei' : 'FALLITO missione compiuta ' + JSON.stringify({ visto, st, dopo, gg }));
  await K.page.evaluate(() => document.querySelector('.fanta').scrollIntoView({ block: 'start' })); await K.page.waitForTimeout(1500); await shot(K.page, '21f-fantasquadra-compiuta');
  await spia(K.page); }
// trofei
await K.page.click('[data-act=tab][data-k=strada]');
await full(K.page, '22-ragazzo-trofei');
await K.page.click('[data-act=mossa][data-k=doppio]'); await K.page.waitForSelector('.foglio .disegno animateMotion', { state: 'attached' });
await K.page.waitForTimeout(900);
{ const r = await K.page.evaluate(() => ({ campo: !!document.querySelector('#foglio .campetto'), gira: ['.att', '.pal', '.att .ga-d'].every(q => document.querySelector('#foglio .campetto ' + q).getAnimations().some(a => a.id === 'ngu')) }));
  console.log(r.campo && r.gira ? 'ok - mossa sbloccata: il Fighter la fa nel campetto (Fighter, palla e gamba si muovono)' : 'FALLITO campetto della mossa ' + JSON.stringify(r)); }
await shot(K.page, '22b-mossa-disegno'); await K.page.click('[data-act=chiudi]');
await K.page.click('[data-act=mossa][data-k=cruyff]'); await K.page.waitForSelector('.foglio .disegno');
console.log(!(await K.page.$('#foglio .campetto')) ? 'ok - mossa non sbloccata: solo il disegno, niente campetto' : 'FALLITO campetto su mossa chiusa');
await shot(K.page, '22d-mossa-chiusa'); await K.page.click('[data-act=chiudi]');
{ const r = await K.page.evaluate(() => ({ mosse: MOSSE.filter(m => !MOSSA_ANIM[m.k]).map(m => m.k), es: Object.keys(ESULTANZE).filter(k => k !== 'salto' && !ES_ANIM[k]),
    strada: STRADA.every((tp, i) => !i || tp.t > STRADA[i - 1].t), buco: Math.max(...STRADA.map((tp, i) => i ? tp.t - STRADA[i - 1].t : 0)),
    premi: STRADA.flatMap(tp => tp.premi).filter(([t, k]) => !({ maglia: KIT, scarpe: SCARPE, sfondo: SFONDI, cornice: CORNICI, acc: ACCESSORI, esultanza: ESULTANZE }[t] || { [k]: 1 })[k]) }));
  console.log(!r.mosse.length && !r.es.length ? 'ok - ogni mossa e ogni esultanza ha il suo movimento' : 'FALLITO movimenti mancanti: ' + JSON.stringify(r));
  console.log(r.strada && r.buco <= 125 && !r.premi.length ? `ok - strada dei trofei in ordine, al massimo ${r.buco} trofei tra un premio e l'altro, tutti i premi esistono` : 'FALLITO strada ' + JSON.stringify(r)); }
{ const r = await K.page.evaluate(() => ({ sfide: SFIDE.filter(s => !DIS_SFIDA[s.k]).map(s => s.k), mosse: MOSSE.filter(m => !DIS_MOSSA[m.k]).map(m => m.k) }));
  console.log(!r.sfide.length && !r.mosse.length ? 'ok - ogni sfida e ogni mossa ha il suo disegno' : 'FALLITO disegni mancanti: ' + JSON.stringify(r));
  // app e database devono avere le stesse sfide, lo stesso giro della sfida della settimana e le stesse sfide «a tempo»
  const app = await K.page.evaluate(() => ({ sfide: SFIDE.map(s => s.k).sort(), meno: SFIDE.filter(s => s.verso < 0).map(s => s.k).sort(), proveMeno: PROVE.filter(p => p.verso < 0).map(p => p.k).sort(),
    giro: Array.from({ length: 60 }, (_, i) => sfidaSettimana('2027-W' + String(i % 52 + 1).padStart(2, '0')).k), mesi: ['2026-W47', '2026-W49', '2026-W53', '2027-W01', '2027-W13'].map(meseSettimana) }));
  const sql = (await db.query(`select (select array_agg(x order by x) from unnest(public.gioco_ammessi('sfide')) x) sfide, (select array_agg(x order by x) from unnest(public.gioco_ammessi('sfide_meno')) x) meno,
    (select array_agg(x order by x) from unnest(public.gioco_ammessi('prove_meno')) x) prove_meno,
    (select array_agg(public.gioco_sfida_settimana('2027-W' || lpad((i % 52 + 1)::text, 2, '0')) order by i) from generate_series(0, 59) i) giro,
    (select array_agg(public.gioco_mese_settimana(w) order by n) from unnest(array['2026-W47', '2026-W49', '2026-W53', '2027-W01', '2027-W13']) with ordinality u(w, n)) mesi`)).rows[0];
  console.log(JSON.stringify(app) === JSON.stringify({ sfide: sql.sfide, meno: sql.meno, proveMeno: sql.prove_meno, giro: sql.giro, mesi: sql.mesi })
    ? 'ok - app e database d\'accordo: 12 sfide, sfide e prove a tempo, giro della sfida della settimana, mese di ogni settimana' : 'FALLITO app e database diversi: ' + JSON.stringify(app) + ' / ' + JSON.stringify(sql));
  await K.page.click('[data-act=tab][data-k=sfide]'); await full(K.page, '22a-dodici-sfide'); await K.page.click('[data-act=tab][data-k=strada]'); }
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
await K.page.click('.foglio [data-act=av][data-t=esultanza][data-k=braccia]').catch(() => console.log('FALLITO esultanza braccia bloccata'));
await K.page.waitForTimeout(450);
{ const r = await K.page.evaluate(() => ({ su: document.querySelector('#anteprima .br-s').getAnimations().some(a => a.id === 'ngu'), chiuse: document.querySelectorAll('.foglio [disabled]').length }));
  console.log(r.su && r.chiuse > 0 ? 'ok - esultanza scelta: l\'anteprima alza le braccia; le esultanze non ancora guadagnate restano chiuse' : 'FALLITO esultanza in anteprima ' + JSON.stringify(r)); }
await shot(K.page, '23-personalizza');
await K.page.evaluate(() => { document.querySelector('.foglio').scrollTop = 0; }); await shot(K.page, '23b-personalizza-in-alto');
await K.page.click('[data-act=salvaAvatar]'); await K.page.waitForTimeout(500);
await shot(K.page, '24-fighter-nuovo');
await K.page.click('.eroe [data-act=salta]'); await K.page.waitForTimeout(500);
console.log((await K.page.evaluate(() => document.querySelector('.eroe .figura').dataset.es === 'braccia' && document.querySelector('.eroe .br-d').getAnimations().some(a => a.id === 'ngu'))) ? 'ok - toccato, il Fighter esulta con l\'esultanza salvata' : 'FALLITO esultanza sulla card');
await shot(K.page, '24b-esultanza');
// fotogrammi di tutte le mosse e di tutte le esultanze, a grandezza vera su uno schermo largo: vanno guardati
{ const F = await contesto({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await F.page.goto(BASE + `gioco.html?s=2015&t=${new URL(K.page.url()).searchParams.get('t')}`); await F.page.waitForSelector('.eroe'); await feste(F.page);
  const fot = async (nome, tempi) => {
    await F.page.evaluate(([tempi, mosse]) => {
      document.getAnimations().forEach(a => a.cancel());
      const quali = mosse ? MOSSE.map(m => m.k) : Object.keys(ES_ANIM);
      const celle = quali.map(k => `<div style="font:800 15px Nunito,sans-serif;color:#fff;align-self:center">${mosse ? MOSSA[k].nome : ESULTANZE[k].nome}</div>` + tempi.map(t => mosse
        ? `<div data-t="${t}" class="fot" style="width:330px">${campetto(k)}</div>` : `<div data-t="${t}" class="fot eroe sf-campo" style="width:330px;margin:0"><div class="figura" data-es="${k}">${fighterSVG(S.io.io.avatar, { numero: 10 })}</div></div>`).join('')).join('');
      const app = document.getElementById('app'); app.style.maxWidth = 'none';
      app.innerHTML = `<div style="display:grid;grid-template-columns:90px repeat(${tempi.length},330px);gap:8px">${celle}</div>`;
      document.querySelectorAll('.fot').forEach(c => {
        const prima = new Set(document.getAnimations());
        if (mosse) faiMossa(c.querySelector('.campetto')); else esulta(c.querySelector('.figura'));
        document.getAnimations().filter(a => !prima.has(a) && a.id === 'ngu').forEach(a => { a.pause(); a.currentTime = +c.dataset.t * a.effect.getTiming().duration; });
      });
    }, [tempi, nome === 'mosse']);
    await full(F.page, `30-fotogrammi-${nome}`);
  };
  await fot('mosse', [.25, .45, .7, .95]);
  await fot('esultanze', [.15, .35, .5, .7]);
  await F.ctx.close(); }
// chi giocava già prima della versione 3 trova una volta sola «Il gioco è cresciuto!» con i premi già guadagnati
{ const attesi = await K.page.evaluate(() => STRADA.filter(tp => tp.n === 3 && tp.t <= S.c.trofei).flatMap(tp => tp.premi).length);
  await K.page.evaluate(id => { for (const v of ['v3', 'v4', 'v5']) localStorage.removeItem('ngu:' + v + ':' + id); }, idLucky);
  await K.page.reload(); await K.page.waitForSelector('.festa');
  let visto = null, n = 0, sfideNuove = false, missioneNuova = false;
  while (await K.page.$('.festa .btn')) { const t = await K.page.evaluate(() => document.querySelector('.festa .scatola').textContent);
    if (t.includes('Novità nel gioco') && t.includes('Missione di fantasquadra')) { missioneNuova = true; await shot(K.page, '31c-missione-nuova'); }
    if (t.includes('Sfide nuove!')) { sfideNuove = true; await shot(K.page, '31b-sfide-nuove'); }
    if (t.includes('Il gioco è cresciuto')) { visto = await K.page.evaluate(() => document.querySelectorAll('.festa .premio').length); await shot(K.page, '31-gioco-cresciuto'); }
    n++; await K.page.click('.festa .btn'); await K.page.waitForTimeout(350); }
  await K.page.reload(); await K.page.waitForSelector('.eroe'); await K.page.waitForTimeout(400);
  console.log(visto === attesi && attesi >= 2 && !(await K.page.$('.festa .btn')) ? `ok - «Il gioco è cresciuto!» compare una volta sola, con i ${attesi} premi nuovi già guadagnati` : 'FALLITO gioco cresciuto: premi ' + visto + ' attesi ' + attesi + ', feste ' + n);
  console.log(sfideNuove ? 'ok - «Sfide nuove!» compare una volta sola a chi giocava già' : 'FALLITO avviso delle sfide nuove');
  console.log(missioneNuova ? 'ok - «Missione di fantasquadra» spiegata una volta sola a chi giocava già' : 'FALLITO avviso della missione nuova'); }
// boss battuto: schermata intera alla prossima apertura
{ await db.query(`update public.gioco_squadre set impostazioni = jsonb_set(impostazioni, '{hp}', '1')`);   // energia al minimo (300)
  await db.query(`insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
                  select '2015', id, 'greencard', '{}'::jsonb, 'mister', public.gioco_settimana(), public.gioco_mese() from public.gioco_giocatori where soprannome in ('Bomber','Dado','Ale','Nico','Edo','Tommi')`);
  const prima = await K.page.evaluate(() => S.c.trofei);
  await K.page.reload(); await K.page.waitForSelector('.festa');
  let visto = false;
  while (await K.page.$('.festa .btn')) { if (await K.page.$('.festa .boss-festa')) { visto = true; await K.page.waitForTimeout(600); await shot(K.page, '32-boss-sconfitto'); } await K.page.click('.festa .btn'); await K.page.waitForTimeout(350); }
  const dopo = await K.page.evaluate(() => S.c.trofei);
  console.log(visto && dopo === prima + 20 ? 'ok - boss battuto: festa «Sconfitto!» all\'apertura e 20 trofei in più' : 'FALLITO festa del boss battuto: vista ' + visto + ', trofei ' + prima + ' → ' + dopo);
  await K.page.click('[data-act=tab][data-k=squadra]'); await K.page.waitForTimeout(300); await shot(K.page, '32b-squadra-boss-battuto'); }
// l'energia tolta al boss: per ogni ragazzo e per ogni mese il conto dell'app (calcola) deve essere quello del database (gioco_danni)
{ // casi difficili su altri ragazzi: sfida della settimana fatta due volte, record oltre le tre sfide, record a tempo,
  // una settimana con le regole di prima, record del combine, e fantasquadre col bonus (tutti con una sfida e una stella)
  const ids = Object.fromEntries((await db.query(`select soprannome, id from public.gioco_giocatori`)).rows.map(r => [r.soprannome, r.id]));
  const ev = (g, tipo, dati, giorniFa = 0, autore = 'genitore') => db.query(`insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese, creato)
    values ('2015', $1, $2, $3, $4, public.gioco_settimana(now() - $5::interval), public.gioco_mese(now() - $5::interval), now() - $5::interval)`, [g, tipo, JSON.stringify(dati), autore, giorniFa + ' days']);
  for (const v of [10, 12]) await ev(ids.Nico, 'sfida', { sfida: SETT, valore: v });                       // la seconda volta niente 5 in più
  for (const v of [30, 20, 18, 19, 17]) await ev(ids.Nico, 'sfida', { sfida: 'spola', valore: v });      // a tempo: meno è meglio
  for (const v of [5, 6, 7, 8, 9]) await ev(ids.Edo, 'sfida', { sfida: 'bersaglio', valore: v }, 21);     // tre settimane fa: regole di prima
  for (const v of [5.2, 4.9, 5.0]) await ev(ids.Edo, 'combine', { prova: 'sprint', valore: v }, 0, 'mister');
  for (const v of [12, 15]) await ev(ids.Edo, 'combine', { prova: 'palleggi', valore: v }, 0, 'mister');
  for (const g of Object.values(ids)) { for (const v of [4, 3, 2]) await ev(g, 'sfida', { sfida: 'stop', valore: v }); for (const a of ['impegno', 'coraggio']) await ev(g, 'stella', { area: a, frase: 0 }, 0, 'mister'); }
  await D.page.reload(); await D.page.waitForSelector('[data-act=stab]');
  const mesi = (await db.query(`select distinct mese from public.gioco_eventi union select public.gioco_mese_settimana(public.gioco_settimana())`)).rows.map(r => r.mese);
  const app = await D.page.evaluate(() => { const X = datiStaff(); return { calc: Object.fromEntries(X.attivi.map(g => [g.id, X.calc[g.id].mesi])), bonus: S.staff.trii.filter(t => t.bonus).length, r4: R4 }; });
  const diversi = []; let somma = 0;
  for (const m of mesi) { const sql = Object.fromEntries((await db.query(`select giocatore, trofei from public.gioco_danni('2015', $1)`, [m])).rows.map(r => [r.giocatore, r.trofei]));
    for (const [g, c] of Object.entries(app.calc)) { somma += sql[g] || 0; if ((c[m] || 0) !== (sql[g] || 0)) diversi.push([Object.keys(ids).find(k => ids[k] === g), m, c[m] || 0, sql[g] || 0]); } }
  console.log(!diversi.length && app.bonus >= 5 && mesi.length >= 2 && somma > 500 ? `ok - energia tolta al boss: app e database danno lo stesso numero per ${Object.keys(app.calc).length} ragazzi in ${mesi.length} mesi (${somma} in tutto, ${app.bonus} bonus fantasquadra)` : 'FALLITO energia del boss diversa (ragazzo, mese, app, database): ' + JSON.stringify(diversi) + ' ' + JSON.stringify({ bonus: app.bonus, mesi, somma })); }
// 6. dirigente: riepilogo e immagine
await D.page.reload(); await D.page.waitForSelector('[data-act=stab]');
await D.page.click('[data-act=stab][data-k=squadra]');
await D.page.waitForTimeout(800);
await full(D.page, '25-dir-squadra');
{ const r = await D.page.evaluate(() => ({ pagina: document.getElementById('app').textContent, testo: testoRiep(), compiute: datiRiep().trii, gruppi: datiRiep().triiTot }));
  console.log(/\d+ passi su \d+/.test(r.pagina) && r.pagina.includes('lo vedete solo voi') && r.testo.includes('con la missione compiuta') && r.compiute >= 2 && r.compiute <= r.gruppi
    ? `ok - mister e dirigente vedono i passi di ogni fantasquadra; nel riepilogo ${r.compiute} missioni compiute su ${r.gruppi}` : 'FALLITO fantasquadre per lo staff ' + JSON.stringify({ compiute: r.compiute, gruppi: r.gruppi, testo: r.testo.slice(0, 200) })); }
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
await D.page.click('[data-act=stab][data-k=stelle]'); await D.page.waitForSelector('[data-act=avvisaStelle]');
await D.page.evaluate(() => document.querySelector('[data-act=avvisaStelle]').scrollIntoView({ block: 'center' })); await shot(D.page, '28b-stelle-messe');
await D.page.click('[data-act=avvisaStelle]'); await D.page.waitForTimeout(200);
{ const t = await D.page.evaluate(() => window.__copiato);
  const nomi = (await db.query(`select nome, soprannome from public.gioco_giocatori`)).rows.flatMap(r => [r.nome, r.soprannome]);
  console.log(t.includes('stelle di questa settimana') && !nomi.some(n => t.includes(n)) ? 'ok - messaggio «Stelle messe»: nessun nome di ragazzo' : 'FALLITO messaggio stelle: ' + t.slice(0, 120)); }
// 7. chi ha "riduci movimento" sul telefono: niente animazioni
{ const R = await contesto({ reducedMotion: 'reduce' });
  await R.page.goto(BASE + `gioco.html?s=2015&t=${tok.Bomber}`); await R.page.waitForSelector('.eroe .corpo');
  await feste(R.page);
  const a = await R.page.evaluate(() => [getComputedStyle(document.querySelector('.eroe .corpo')).animationName, getComputedStyle(document.querySelector('.app > .pan')).animationName]);
  console.log(a.every(x => x === 'none') ? 'ok - con "riduci movimento" il Fighter e le schede stanno fermi' : 'FALLITO riduci movimento: ' + a);
  const m = await R.page.evaluate(() => { const f = document.querySelector('.eroe .figura'); f.dataset.es = 'capriola'; esulta(f); return muovi(f.querySelector('svg'), ES_ANIM.braccia) + document.getAnimations().filter(x => x.id === 'ngu').length; });
  console.log(m === 0 ? 'ok - con "riduci movimento" mosse ed esultanze non partono' : 'FALLITO riduci movimento sulle esultanze: ' + m); }
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
