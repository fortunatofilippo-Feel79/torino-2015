// Collaudo del database del gioco: carica sql/supabase-gioco.sql in PostgreSQL 16 (PGlite)
// e verifica permessi, regole e calcoli. Ogni riga FALLITO fa uscire con errore.
import { nuovoDb } from './db.mjs';
const db = await nuovoDb();
const q = async (sql, p=[]) => (await db.query(sql, p)).rows;
const call = async (fn, args) => { const keys = Object.keys(args); const r = await q(`select public.${fn}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as r`, Object.values(args)); return r[0].r; };
const ok = (c, m) => { if (!c) { console.error('FALLITO:', m); process.exitCode = 1; } else console.log('ok -', m); };
const S = '2015', P = 'pwd-dirigente';
// il collaudo decide che giorno è: 1 lunedì … 7 domenica (in produzione lo dice l'orologio di Roma)
const giorno = n => db.exec(`create or replace function public.gioco_giorno(p_ts timestamptz default now()) returns integer language sql stable set search_path = '' as $$ select ${n} $$`);
const danni = async (g, mese) => { const r = await q(`select trofei from public.gioco_danni($1, $2) where giocatore = $3`, [S, mese, g]); return r.length ? r[0].trofei : 0; };
// funzioni di servizio della versione 4, con l'orologio vero
{ const g = async t => (await q(`select public.gioco_giorno($1::timestamptz) g`, [t]))[0].g;
  ok(await g('2026-11-16 12:00+01') === 1 && await g('2026-11-20 08:00+01') === 5 && await g('2026-11-22 23:59+01') === 7 && await g('2026-11-19 23:30+00') === 5, 'giorno della settimana a Roma (anche a cavallo della mezzanotte)');
  const giro = (await q(`select public.gioco_sfida_settimana('2026-W' || lpad(n::text, 2, '0')) k from generate_series(1, 12) n`)).map(r => r.k);
  const amm = (await q(`select public.gioco_ammessi('sfide') a`))[0].a;
  ok(new Set(giro).size === 12 && amm.length === 12 && giro.every(k => amm.includes(k)), 'sfida della settimana: dodici settimane, dodici sfide diverse, tutte ammesse');
  const ms = async w => (await q(`select public.gioco_mese_settimana($1) m`, [w]))[0].m;
  ok(await ms('2026-W47') === '2026-11' && await ms('2026-W49') === '2026-12' && await ms('2026-W53') === '2027-01', 'una settimana conta nel mese della sua domenica'); }
// staff prima dell'attivazione
let st = await call('gioco_staff', {p_squadra:S, p_chiave:P}); ok(st.attivo === false && st.ruolo==='dirigente', 'dirigente vede gioco non attivo');
ok((await call('gioco_staff', {p_squadra:S, p_chiave:'sbagliata'})).errore === 'chiave', 'chiave sbagliata rifiutata');
ok((await call('gioco_staff', {p_squadra:S, p_chiave:'cod-aiutante'})).errore === 'chiave', 'codice aiutante non basta');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'attiva', p_dati:{}})).ok, 'attivazione');
st = await call('gioco_staff', {p_squadra:S, p_chiave:P});
const W = st.ora.settimana;
ok(st.squadra.impostazioni.regole4 === W && st.squadra.impostazioni.regole5 === W, 'squadra nuova: regole delle versioni 4 e 5 da subito (' + W + ')');
const INV = st.squadra.codice_invito, MIS = st.squadra.codice_mister;
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(INV) && MIS.length===10, 'codici generati '+INV);
ok((await call('gioco_staff', {p_squadra:S, p_chiave:MIS})).ruolo === 'mister' && (await call('gioco_staff', {p_squadra:S, p_chiave:MIS})).squadra.codice_invito == null, 'mister non vede i codici');
// pubblico
ok((await call('gioco_pubblico', {p_squadra:S, p_invito:'XXXXXX'})).errore==='invito', 'invito sbagliato');
let pub = await call('gioco_pubblico', {p_squadra:S, p_invito:INV.toLowerCase()}); ok(pub.ok && pub.rosa_libera.length===7, 'rosa libera 7 (invito minuscolo accettato)');
// iscrizioni
const tok = {};
const nomi = [['r1','Lucky',10],['r2','Bomber',9],['r3','Tommi',7],['r4','Ale',4],['r5','Dado',5]];
for (const [rid, sop, num] of nomi) { const r = await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:rid, p_nome:null, p_soprannome:sop, p_numero:num, p_avatar:{pelle:2}, p_pin:'1234'}); ok(r.ok && r.token.length===64, 'iscritto '+sop); tok[sop]=r.token; }
ok((await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:'r1', p_nome:null, p_soprannome:'Altro', p_numero:3, p_avatar:{}, p_pin:'1234'})).errore==='preso', 'nome già preso');
ok((await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:'', p_nome:'Nuovo K.', p_soprannome:'<b>x', p_numero:3, p_avatar:{}, p_pin:'1234'})).errore==='soprannome', 'soprannome con < rifiutato');
ok((await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:'', p_nome:'Nuovo K.', p_soprannome:'Nuovo', p_numero:3, p_avatar:{}, p_pin:'12a4'})).errore==='pin', 'pin non numerico rifiutato');
const rn = await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:'', p_nome:'Pietro V.', p_soprannome:'Pit', p_numero:11, p_avatar:{}, p_pin:'0000'}); ok(rn.ok, 'iscritto fuori rosa'); tok.Pit = rn.token;
pub = await call('gioco_pubblico', {p_squadra:S, p_invito:INV}); ok(pub.rosa_libera.length===2, 'rosa libera scesa a 2');
// in attesa
let io = await call('gioco_io', {p_token: tok.Lucky}); ok(io.io.stato==='attesa' && io.compagni.length===0, 'in attesa non vede i compagni');
ok((await call('gioco_ragazzo', {p_token: tok.Lucky, p_azione:'obiettivo', p_dati:{obiettivo:'debole'}})).errore==='attesa', 'in attesa non può giocare');
ok((await call('gioco_ragazzo', {p_token: tok.Lucky, p_azione:'avatar', p_dati:{avatar:{pelle:3}, soprannome:'Lucky7', numero:'7'}})).ok, 'avatar in attesa');
ok((await call('gioco_io', {p_token: 'finto'})).errore==='link', 'token finto');
// approvazioni (mister non può)
st = await call('gioco_staff', {p_squadra:S, p_chiave:P});
const id = Object.fromEntries(st.giocatori.map(g=>[g.soprannome,g.id]));
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'approva', p_dati:{giocatore:id.Bomber}})).errore==='solo_dirigente', 'mister non approva');
for (const s of ['Lucky7','Bomber','Tommi','Ale','Dado']) ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'approva', p_dati:{giocatore:id[s]}})).ok, 'approvato '+s);
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'rifiuta', p_dati:{giocatore:id.Pit}})).ok, 'rifiutato Pit');
ok((await call('gioco_io', {p_token: tok.Pit})).errore==='link', 'rifiutato non entra più');
// soprannome bloccato dopo approvazione
await call('gioco_ragazzo', {p_token: tok.Lucky, p_azione:'avatar', p_dati:{avatar:{pelle:4}, soprannome:'Cambiato'}});
io = await call('gioco_io', {p_token: tok.Lucky}); ok(io.io.soprannome==='Lucky7' && io.io.avatar.pelle===4, 'soprannome bloccato, avatar cambiato');
ok(io.compagni.length===5 && io.trio && io.trio.length>=1, 'vede compagni e trio ('+io.trio.length+')');
// trii: 5 attivi -> g=1 gruppo da 5
const tr = await q(`select gruppo, count(*) n from public.gioco_trii group by gruppo`); ok(tr.length===1 && Number(tr[0].n)===5, 'trii creati: '+JSON.stringify(tr));
// stelle
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'stella', p_dati:{giocatore:id.Bomber, area:'coraggio', frase:0}})).ok, 'stella mister');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'stella', p_dati:{giocatore:id.Bomber, area:'coraggio', frase:1}})).errore==='gia_data', 'una stella per area a settimana');
await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'impostazioni', p_dati:{figlio:id.Tommi, premio:'Pizza di squadra', boss_nome:'Nebbia Nera', hp:100}});
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'stella', p_dati:{giocatore:id.Tommi, area:'impegno', frase:0}})).errore==='figlio', 'dirigente non dà stelle al figlio');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'stella', p_dati:{giocatore:id.Tommi, area:'impegno', frase:0}})).ok, 'mister sì');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'greencard', p_dati:{giocatore:id.Tommi}})).errore==='figlio', 'dirigente non dà la green card al figlio');
io = await call('gioco_io', {p_token: tok.Tommi}); ok(io.squadra.impostazioni.figlio === undefined && io.squadra.impostazioni.premi, 'il ragazzo non vede chi è il figlio');
// sfide con pin
let r = await call('gioco_ragazzo', {p_token: tok.Bomber, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'23', pin:'9999'}}); ok(r.errore==='pin' && r.tentativi===7, 'pin errato conteggiato (persiste)');
r = await call('gioco_ragazzo', {p_token: tok.Bomber, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'23', pin:'1234'}}); ok(r.ok, 'sfida confermata');
ok((await q(`select pin_errori from public.gioco_giocatori where id=$1`,[id.Bomber]))[0].pin_errori===0, 'errori azzerati');
ok((await call('gioco_ragazzo', {p_token: tok.Bomber, p_azione:'sfida', p_dati:{sfida:'slalom', valore:'12.4', pin:'1234'}})).ok, 'sfida a tempo decimale');
ok((await call('gioco_ragazzo', {p_token: tok.Bomber, p_azione:'sfida', p_dati:{sfida:'hack', valore:'1', pin:'1234'}})).errore==='sfida', 'sfida inventata rifiutata');
ok((await call('gioco_ragazzo', {p_token: tok.Bomber, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'-3', pin:'1234'}})).errore==='valore', 'valore negativo rifiutato');
// obiettivo e autovalutazione
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'autovalutazione', p_dati:{esito:'fatto'}})).errore==='senza_obiettivo', 'autovalutazione senza obiettivo');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'obiettivo', p_dati:{obiettivo:'debole'}})).ok, 'obiettivo');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'obiettivo', p_dati:{obiettivo:'chiedi'}})).ok, 'obiettivo cambiato');
await giorno(4);
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'autovalutazione', p_dati:{esito:'quasi'}})).errore==='presto', 'autovalutazione di giovedì: troppo presto');
await giorno(5);
ok((await call('gioco_io', {p_token: tok.Ale})).ora.giorno === 5, 'il ragazzo riceve il giorno della settimana');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'autovalutazione', p_dati:{esito:'quasi'}})).errore==='oggi', 'autovalutazione di venerdì ma obiettivo scelto oggi: no');
await q(`update public.gioco_eventi set creato = creato - interval '1 day' where giocatore = $1 and tipo = 'obiettivo'`, [id.Ale]);
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'autovalutazione', p_dati:{esito:'quasi'}})).ok, 'autovalutazione di venerdì con obiettivo scelto ieri');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'obiettivo', p_dati:{obiettivo:'debole'}})).errore==='gia_valutato', 'obiettivo bloccato dopo autovalutazione');
// gg
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'gg', p_dati:{a:id.Bomber, frase:3}})).ok, 'gg al compagno di trio');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'gg', p_dati:{a:id.Bomber, frase:2}})).errore==='gia_inviato', 'un gg a settimana per compagno');
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'gg', p_dati:{a:id.Ale, frase:2}})).errore==='compagno', 'gg a se stesso no');
io = await call('gioco_io', {p_token: tok.Bomber}); ok(io.gg_ricevuti.length===1 && io.gg_ricevuti[0].da==='Ale', 'gg ricevuto con mittente');
// mosse, combine, greencard, annulla
const m1 = await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'mossa', p_dati:{giocatore:id.Dado, mossa:'doppio'}}); ok(m1.ok, 'mossa sbloccata');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'mossa', p_dati:{giocatore:id.Dado, mossa:'doppio'}})).errore==='gia_data', 'mossa doppia no');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'combine', p_dati:{giocatore:id.Dado, prova:'sprint', valore:'4.35'}})).ok, 'combine');
const gc = await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'greencard', p_dati:{giocatore:id.Ale}}); ok(gc.ok, 'green card');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'annulla', p_dati:{evento:String(gc.id)}})).errore==='evento', 'mister non annulla quanto fatto dal dirigente');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'annulla', p_dati:{evento:String(m1.id)}})).ok, 'mister annulla la sua mossa');
await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'mossa', p_dati:{giocatore:id.Dado, mossa:'doppio'}});
// trio bonus: tutti con sfida e stella
for (const s of ['Lucky7','Tommi','Ale','Dado']) { await call('gioco_ragazzo', {p_token: tok[s==='Lucky7'?'Lucky':s], p_azione:'sfida', p_dati:{sfida:'muro_f', valore:'18', pin:'1234'}}); }
for (const s of ['Lucky7','Ale','Dado']) await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'stella', p_dati:{giocatore:id[s], area:'squadra', frase:1}});
// missione di fantasquadra (versione 5): passi = sfide a casa (al massimo 3) + stelle + GG mandati; traguardo 4 a testa
const passiVeri = async () => { let n = 0; for (const r of await q(`select tipo, giocatore, count(*) c from public.gioco_eventi where settimana = $1 and tipo in ('sfida','stella','gg') and giocatore = any($2::uuid[]) group by 1, 2`, [W, ['Lucky7','Bomber','Tommi','Ale','Dado'].map(s => id[s])])) n += r.tipo === 'sfida' ? Math.min(3, Number(r.c)) : Number(r.c); return n; };
io = await call('gioco_io', {p_token: tok.Bomber});
ok(io.missione.membri === 5 && io.missione.traguardo === 20 && io.missione.passi === await passiVeri() && io.missione.passi < 20 && !io.missione.compiuta && io.bonus_trio.length === 0, 'missione di fantasquadra: ' + io.missione.passi + ' passi su 20, non ancora compiuta');
ok(io.trio.every(t => t.passi === undefined && t.totale === undefined && t.fatto === true), 'dei compagni il ragazzo riceve solo «ha dato una mano», mai i passi di ognuno');
// con la regola di prima (settimane precedenti al passaggio) bastava una sfida e una stella a testa
await q(`update public.gioco_squadre set impostazioni = impostazioni || '{"regole5":"9999-W01"}'::jsonb where id = $1`, [S]);
io = await call('gioco_io', {p_token: tok.Bomber}); ok(io.trio.every(t=>t.bonus) && io.bonus_trio.length===1, 'regola di prima: bonus a tutti con una sfida e una stella a testa');
await q(`update public.gioco_squadre set impostazioni = impostazioni || jsonb_build_object('regole5', $2::text) where id = $1`, [S, W]);
// i GG sono passi: mandandoseli la fantasquadra arriva al traguardo
{ const cinque = ['Lucky7','Bomber','Tommi','Ale','Dado'];
  for (const a of cinque) for (const b of cinque) if (a !== b && (await call('gioco_io', {p_token: tok.Bomber})).missione.passi < 20) await call('gioco_ragazzo', {p_token: tok[a === 'Lucky7' ? 'Lucky' : a], p_azione:'gg', p_dati:{a:id[b], frase:1}});
  io = await call('gioco_io', {p_token: tok.Bomber});
  ok(io.missione.passi === 20 && io.missione.passi === await passiVeri() && io.missione.compiuta && io.trio.every(t=>t.bonus) && io.bonus_trio.length===1, 'missione compiuta a 20 passi: bonus a chi ha dato una mano'); }
// chi non ha fatto nemmeno un passo non prende il bonus; sotto il traguardo non lo prende nessuno (settimane finte, poi cancellate)
{ const ev = (g, tipo, sett, n) => q(`insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese) select $1, $2, $3, '{}'::jsonb, 'mister', $4, '9998-03' from generate_series(1, $5::integer)`, [S, g, tipo, sett, n]);
  const stato = async sett => Object.fromEntries((await q(`select x.soprannome s, m.passi, m.totale, m.traguardo, m.compiuta, m.bonus from public.gioco_missione_stato($1) m join public.gioco_giocatori x on x.id = m.giocatore where m.settimana = $2`, [S, sett])).map(r => [r.s, r]));
  for (const s of ['Lucky7','Tommi','Dado']) await q(`insert into public.gioco_trii values ($1, '9998-W10', $2, 0)`, [S, id[s]]);
  await ev(id.Lucky7, 'sfida', '9998-W10', 5); await ev(id.Lucky7, 'stella', '9998-W10', 4); await ev(id.Tommi, 'gg', '9998-W10', 5);
  let m = await stato('9998-W10');
  ok(m.Lucky7.passi === 7 && m.Tommi.passi === 5 && m.Dado.passi === 0 && m.Lucky7.totale === 12 && m.Lucky7.traguardo === 12 && m.Lucky7.compiuta && m.Lucky7.bonus && m.Tommi.bonus && m.Dado.compiuta && !m.Dado.bonus, 'missione: le sfide oltre la terza non sono passi; a 12 su 12 bonus a Lucky e Tommi, non a Dado che non ha fatto un passo');
  await q(`delete from public.gioco_eventi where id = (select max(id) from public.gioco_eventi where settimana = '9998-W10' and tipo = 'gg')`);
  m = await stato('9998-W10'); ok(m.Lucky7.totale === 11 && !m.Lucky7.compiuta && !m.Lucky7.bonus && !m.Tommi.bonus, 'missione: a 11 su 12 non è compiuta e nessuno prende il bonus');
  // regola di prima su una settimana vecchia: due compagni con una sfida e una stella a testa (4 passi su 8) hanno il bonus
  for (const s of ['Lucky7','Tommi']) { await q(`insert into public.gioco_trii values ($1, '2000-W10', $2, 0)`, [S, id[s]]); await ev(id[s], 'sfida', '2000-W10', 1); await ev(id[s], 'stella', '2000-W10', 1); }
  m = await stato('2000-W10'); ok(m.Lucky7.totale === 4 && m.Lucky7.traguardo === 8 && m.Lucky7.bonus && m.Tommi.bonus, 'settimane prima del passaggio: resta la regola vecchia (bonus con 4 passi su 8)');
  await q(`delete from public.gioco_eventi where settimana in ('9998-W10', '2000-W10')`); await q(`delete from public.gioco_trii where settimana in ('9998-W10', '2000-W10')`); }
// tifo: una frase pronta a tutta la fantasquadra, al massimo tre a settimana; non è un passo e non dà trofei
{ const prima = (await call('gioco_io', {p_token: tok.Ale})).missione.passi, dPrima = await danni(id.Ale, st.ora.mese);
  ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:2}})).ok, 'tifo alla fantasquadra');
  ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:9}})).errore === 'tifo' && (await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:'<b>ciao'}})).errore === 'tifo', 'tifo: solo le frasi pronte, niente testo libero');
  io = await call('gioco_io', {p_token: tok.Bomber});
  ok(io.tifo.length === 1 && io.tifo[0].da === 'Ale' && io.tifo[0].frase === 2 && io.tifo[0].da_id === id.Ale, 'il compagno di fantasquadra vede il tifo con il mittente');
  await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:0}}); await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:1}});
  ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'tifo', p_dati:{frase:3}})).errore === 'troppo_tifo', 'tifo: al massimo tre a settimana');
  ok((await call('gioco_io', {p_token: tok.Ale})).missione.passi === prima && await danni(id.Ale, st.ora.mese) === dPrima, 'il tifo non è un passo e non toglie energia al boss'); }
// il bonus fantasquadra toglie energia al boss: 10 a testa, nel mese della domenica di quella settimana
{ const mb = (await q(`select public.gioco_mese_settimana($1) m`, [W]))[0].m, con = await danni(id.Tommi, mb);
  await q(`delete from public.gioco_trii where giocatore = $1 and settimana = $2`, [id.Tommi, W]);
  const senza = await danni(id.Tommi, mb);
  await q(`insert into public.gioco_trii (squadra, settimana, giocatore, gruppo) values ($1, $2, $3, 0)`, [S, W, id.Tommi]);
  ok(con - senza === 10 && await danni(id.Tommi, mb) === con, 'boss: il bonus fantasquadra conta 10 (' + senza + ' → ' + con + ')'); }
// boss: hp = max(300, 100*5)=500, approvati da meno di 7 giorni -> devono=0
console.log('boss', JSON.stringify(io.boss));
await q(`update public.gioco_giocatori set approvato = now() - interval '10 days'`);
io = await call('gioco_io', {p_token: tok.Bomber}); console.log('boss dopo 10gg', JSON.stringify(io.boss));
// forza danni: altre stelle e mosse
for (const s of ['Lucky7','Bomber','Tommi','Ale','Dado']) for (const mm of ['finta','cruyff','stop','esterno']) await call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'mossa', p_dati:{giocatore:id[s], mossa:mm}});
io = await call('gioco_io', {p_token: tok.Bomber}); ok(io.boss.sconfitto && io.boss_vinti.length===1, 'boss sconfitto: '+JSON.stringify(io.boss));
console.log('bacheca', io.bacheca.length, io.bacheca.slice(0,3).map(b=>b.tipo+':'+(b.chi||b.mese)).join(' | '));
// staff vede tutto
st = await call('gioco_staff', {p_squadra:S, p_chiave:P}); ok(st.eventi.length>20 && st.trii.length===5 && st.rosa.length===7, 'staff: eventi '+st.eventi.length);
// nuovo link e pin
const nl = await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'nuovo_link', p_dati:{giocatore:id.Dado}}); ok(nl.token && (await call('gioco_io', {p_token: tok.Dado})).errore==='link' && (await call('gioco_io', {p_token: nl.token})).ok, 'nuovo link: il vecchio non vale più');
// pin bloccato dopo 8 errori
for (let i=0;i<8;i++) await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'5', pin:'0000'}});
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'5', pin:'1234'}})).errore==='pin_bloccato', 'pin bloccato dopo 8 errori');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'nuovo_pin', p_dati:{giocatore:id.Ale, pin:'4321'}})).ok && (await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'sfida', p_dati:{sfida:'palleggi', valore:'5', pin:'4321'}})).ok, 'nuovo pin sblocca');
// nuovo arrivato a metà settimana
const r7 = await call('gioco_iscrivi', {p_squadra:S, p_invito:INV, p_rosa_id:'r7', p_nome:null, p_soprannome:'Edo', p_numero:8, p_avatar:{}, p_pin:'1111'});
const idEdo = r7.id; await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'approva', p_dati:{giocatore:idEdo}});
io = await call('gioco_io', {p_token: r7.token}); ok(io.trio && io.trio.length===1, 'nuovo arrivato: gruppo nuovo perché gli altri hanno già 3+ ('+(io.trio||[]).length+')');
// Edo è arrivato dopo il sorteggio ed è da solo nel suo gruppo: niente tifo, e non vede quello degli altri
ok((await call('gioco_ragazzo', {p_token: r7.token, p_azione:'tifo', p_dati:{frase:1}})).errore === 'solo' && io.tifo.length === 0 && io.missione.membri === 1 && !io.missione.compiuta, 'da solo nel gruppo: niente tifo e niente missione');
// il tifo non vale come «aver fatto qualcosa nel mese» per il premio del boss
await q(`insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese) values ($1, $2, 'tifo', '{"frase":1}'::jsonb, 'ragazzo', $3, $4)`, [S, idEdo, W, st.ora.mese]);
ok((await call('gioco_io', {p_token: r7.token})).boss_vinti.length === 0, 'solo tifo nel mese: niente premio del boss');
// sfide nuove e regole della versione 4, su Edo che non ha ancora fatto niente
{ const M = st.ora.mese, sett = (await q(`select public.gioco_sfida_settimana($1) k`, [W]))[0].k, altra = sett === 'bersaglio' ? 'stop' : 'bersaglio';
  const sf = (k, v) => call('gioco_ragazzo', {p_token: r7.token, p_azione:'sfida', p_dati:{sfida:k, valore:String(v), pin:'1111'}});
  ok((await sf(sett, 10)).ok && (await sf(sett, 12)).ok && (await sf(altra, 5)).ok && (await sf(altra, 6)).ok && (await sf(altra, 7)).ok, 'sfide nuove accettate (' + sett + ', ' + altra + ')');
  // regole nuove: 5+5 sfida della settimana · 5+5 record · 5 · quarta e quinta della settimana: niente, nemmeno il record
  ok(await danni(idEdo, M) === 25, 'regole v4: sfida della settimana +5, record solo nelle prime tre (25, trovato ' + await danni(idEdo, M) + ')');
  // regole vecchie (settimane prima del passaggio): niente sfida della settimana, il record vale sempre
  await q(`update public.gioco_squadre set impostazioni = impostazioni || '{"regole4":"9999-W01"}'::jsonb where id = $1`, [S]);
  ok(await danni(idEdo, M) === 30, 'regole di prima: 5 · 5+5 · 5 · record · record (30, trovato ' + await danni(idEdo, M) + ')');
  // dove «meglio» è meno: spola 20, poi 18 (record), poi 19 (no)
  await sf('spola', 20); await sf('spola', 18); await sf('spola', 19);
  ok(await danni(idEdo, M) === 35, 'record a tempo: conta solo il tempo più basso (35, trovato ' + await danni(idEdo, M) + ')');
  await q(`update public.gioco_squadre set impostazioni = impostazioni || jsonb_build_object('regole4', $2::text) where id = $1`, [S, W]);
  // combine: 5 a prova, +10 se batte il record (sprint: meno è meglio; palleggi: più è meglio)
  const cb = (p, v) => call('gioco_staff_azione', {p_squadra:S, p_chiave:MIS, p_azione:'combine', p_dati:{giocatore:idEdo, prova:p, valore:String(v)}});
  const prima = await danni(idEdo, M);
  await cb('sprint', 4.5); await cb('sprint', 4.2); await cb('sprint', 4.4); await cb('palleggi', 10); await cb('palleggi', 9);
  ok(await danni(idEdo, M) - prima === 35, 'boss: il record del combine conta 10 (5 prove da 5, un record: 35, trovato ' + (await danni(idEdo, M) - prima) + ')'); }
// elimina
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'elimina', p_dati:{giocatore:id.Bomber}})).ok, 'elimina');
ok(Number((await q(`select count(*) n from public.gioco_eventi where giocatore=$1 or dati->>'a'=$2`,[id.Bomber, id.Bomber]))[0].n)===0, 'eliminati anche i suoi dati e i gg ricevuti');
// permessi come anon
await db.exec('set role anon');
let negato = false; try { await db.query('select * from public.gioco_eventi'); } catch(e) { negato = /permission/.test(e.message); }
ok(negato, 'anon non legge le tabelle');
negato = false; try { await db.query('select public.gioco_hash($1)', ['x']); } catch(e) { negato = /permission/.test(e.message); }
ok(negato, 'anon non chiama le funzioni di servizio');
const ra = (await db.query('select public.gioco_io($1) r', [r7.token])).rows[0].r; ok(ra.ok, 'anon usa gioco_io');
await db.exec('reset role');
const ctl = await q(`select tipo, nome, chi_ha_il_link from (
  select 'funzione' as tipo, p.proname as nome, case when has_function_privilege('anon', p.oid, 'execute') then 'si può chiamare' else 'niente' end as chi_ha_il_link
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'gioco\\_%') t where chi_ha_il_link <> 'niente' order by nome`);
console.log('chiamabili da anon:', ctl.map(x=>x.nome).join(', '));
ok(ctl.map(x=>x.nome).join(',') === 'gioco_io,gioco_iscrivi,gioco_pubblico,gioco_ragazzo,gioco_staff,gioco_staff_azione', 'dalla chiave pubblica si chiamano solo le sei funzioni');
// passaggio alla versione 4 di una squadra che giocava già: regole nuove dal lunedì dopo, e rilanciare non cambia niente
{ const fs = await import('fs');
  const sql = fs.readFileSync(new URL('../sql/supabase-gioco.sql', import.meta.url), 'utf8');
  await q(`insert into public.gioco_squadre (id, codice_invito, codice_mister) values ('2014', 'AAAAAA', 'BBBBBBBBBB')`);
  const conta = async () => (await q(`select (select count(*) from public.gioco_eventi) e, (select count(*) from public.gioco_giocatori) g, (select count(*) from public.gioco_trii) t, (select count(*) from public.gioco_boss) b`))[0];
  const prima = JSON.stringify(await conta());
  await db.exec(sql);
  const r1 = Object.fromEntries((await q(`select id, (impostazioni->>'regole4') || ' ' || (impostazioni->>'regole5') r from public.gioco_squadre`)).map(x => [x.id, x.r]));
  const prossima = (await q(`select public.gioco_settimana(now() + interval '7 days') w`))[0].w;
  await db.exec(sql);
  const r2 = Object.fromEntries((await q(`select id, (impostazioni->>'regole4') || ' ' || (impostazioni->>'regole5') r from public.gioco_squadre`)).map(x => [x.id, x.r]));
  ok(r1['2014'] === prossima + ' ' + prossima && r1['2015'] === W + ' ' + W && JSON.stringify(r1) === JSON.stringify(r2), 'SQL rilanciato due volte: la squadra che giocava già passa alle regole nuove da ' + prossima + ', l\'altra non cambia');
  ok(JSON.stringify(await conta()) === prima, 'SQL rilanciato: nessun dato perso ' + prima); }
