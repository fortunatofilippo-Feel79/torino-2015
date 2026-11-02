// Collaudo del database del gioco: carica sql/supabase-gioco.sql in PostgreSQL 16 (PGlite)
// e verifica permessi, regole e calcoli. Ogni riga FALLITO fa uscire con errore.
import { nuovoDb } from './db.mjs';
const db = await nuovoDb();
const q = async (sql, p=[]) => (await db.query(sql, p)).rows;
const call = async (fn, args) => { const keys = Object.keys(args); const r = await q(`select public.${fn}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as r`, Object.values(args)); return r[0].r; };
const ok = (c, m) => { if (!c) { console.error('FALLITO:', m); process.exitCode = 1; } else console.log('ok -', m); };
const S = '2015', P = 'pwd-dirigente';
// staff prima dell'attivazione
let st = await call('gioco_staff', {p_squadra:S, p_chiave:P}); ok(st.attivo === false && st.ruolo==='dirigente', 'dirigente vede gioco non attivo');
ok((await call('gioco_staff', {p_squadra:S, p_chiave:'sbagliata'})).errore === 'chiave', 'chiave sbagliata rifiutata');
ok((await call('gioco_staff', {p_squadra:S, p_chiave:'cod-aiutante'})).errore === 'chiave', 'codice aiutante non basta');
ok((await call('gioco_staff_azione', {p_squadra:S, p_chiave:P, p_azione:'attiva', p_dati:{}})).ok, 'attivazione');
st = await call('gioco_staff', {p_squadra:S, p_chiave:P});
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
ok((await call('gioco_ragazzo', {p_token: tok.Ale, p_azione:'autovalutazione', p_dati:{esito:'quasi'}})).ok, 'autovalutazione');
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
io = await call('gioco_io', {p_token: tok.Bomber}); ok(io.trio.every(t=>t.bonus) && io.bonus_trio.length===1, 'bonus trio raggiunto');
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
