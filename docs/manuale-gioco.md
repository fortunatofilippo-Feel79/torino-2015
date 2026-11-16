# Gioco NEVER GIVE UP — manuale tecnico

Versione 4, 16 novembre 2026 (sei sfide nuove, sfida della settimana, autovalutazione dal
venerdì, record solo nelle prime tre sfide, il boss conta ogni trofeo: **cambia lo SQL**).
Versione 3 del 15 novembre 2026 (il Fighter fa mosse ed esultanze, medaglie, traguardi, strada
più fitta, boss a fasi). Versione 2 del 2 novembre 2026 (grafica, movimento e suoni). Versione 1
online dal 2 novembre 2026.
Da leggere prima di ogni modifica al gioco.
Questa è la copia di riferimento: sta nel repository accanto al codice e si aggiorna nella
stessa pull request che cambia il gioco.

## Cos'è

È un'app separata dall'app partite, pensata per i ragazzi dell'annata 2015. Ogni
ragazzo ha un avatar (il "Fighter") con la maglia granata e guadagna trofei con impegno,
coraggio, rispetto e spirito di squadra. Gol, vittorie e minuti giocati non contano.

Contiene: card del Fighter con 8 statistiche, strada dei trofei con sblocchi, sfide a casa
confermate dal genitore con il PIN, obiettivo della settimana con autovalutazione, mosse
speciali sbloccate dal mister, fantasquadra sorteggiata ogni lunedì, boss del mese,
bacheca, combine, riepilogo settimanale per il gruppo dei genitori.

Dalla versione 2 lo stile è più vicino ai giochi che i ragazzi conoscono (tipo Brawl Stars):
Fighter con ombre e tacchetti che respira e salta, disegni per sfide e mosse, feste a schermo
intero, trofei che contano, boss che trema, suoni generati dal telefono. Vedi «Grafica,
movimento e suoni».

Dalla versione 3 c'è più da fare e più da guadagnare: il Fighter fa davvero le mosse che il
mister sblocca, ogni sfida a casa ha tre medaglie, la strada dei trofei ha un premio ogni 125
trofei al massimo, il boss cambia faccia, la pagina Fighter dice cosa si può fare adesso.
Vedi «Versione 3». Con la versione 3 il database non è cambiato.

Dalla versione 4 le sfide a casa sono dodici, ogni lunedì ce n'è una «della settimana» che
vale di più, e sono corretti tre difetti di regole. Vedi «Versione 4». **Lo SQL è cambiato e
va rilanciato in Supabase prima di approvare la pull request.**

## File

Tutto nel repository `torino-2015`, che è **pubblico**: niente password né codici.

| File | Cosa fa |
|---|---|
| `gioco.html` | l'app, per ragazzi, mister e dirigente |
| `sql/supabase-gioco.sql` | tabelle e funzioni del gioco su Supabase (si lancia a mano) |
| `docs/manuale-gioco.md` | questo manuale |
| `docs/guida-gioco.md` | guida d'uso per dirigente e mister |
| `test/` | collaudo: database e app su telefono simulato |
| `CLAUDE.md` | istruzioni che Claude Code legge a ogni sessione |
| `.nojekyll` | GitHub Pages pubblica i file così come sono, senza trasformarli |

`index.html` e `societa.html` **non sono stati toccati**: il gioco vive in `gioco.html`.
Stesso server Supabase e stessa chiave publishable dell'app partite.

Link: `https://fortunatofilippo-feel79.github.io/torino-2015/gioco.html`

## Installazione (una volta sola)

Passi 1 e 2 fatti il 2 novembre 2026.

1. Supabase › SQL Editor › New query: incolla tutto `sql/supabase-gioco.sql` e premi Run.
   Si può rieseguire senza danni. In fondo esce una tabella di controllo: devono risultare
   chiamabili solo `gioco_pubblico`, `gioco_iscrivi`, `gioco_io`, `gioco_ragazzo`,
   `gioco_staff`, `gioco_staff_azione`. Tutte le altre `gioco_*`, funzioni e tabelle: «niente».
2. Carica `gioco.html` nel repository (stessa cartella di `index.html`).
3. Apri `gioco.html?staff=1`, metti la password del dirigente dell'annata, premi **Attiva il gioco**.
4. Scheda **Squadra** › **Messaggio genitori** e **Messaggio mister**.

## Chi entra e come

| Chi | Come entra | Cosa può fare |
|---|---|---|
| Dirigente | password dell'annata (tabella `chiavi`, la stessa dell'app partite) | tutto: approvare, stelle, mosse, combine, link, PIN, impostazioni, backup |
| Mister | link con `&m=CODICE` (codice in `gioco_squadre.codice_mister`) | stelle, mosse, combine, Green Card; annulla solo ciò che ha fatto lui |
| Ragazzo | si iscrive con il link `&i=CODICE`, poi ha un link personale `&t=TOKEN` | gioca; resta in attesa finché il dirigente non lo approva |
| Genitore | PIN di 4 cifre scelto all'iscrizione | conferma le sfide a casa |

Il codice aiutante dell'app partite non dà accesso al gioco.
Sul database c'è solo l'impronta (sha256) dei link personali e dei PIN, mai il valore.
Dopo 8 PIN sbagliati il PIN si blocca: il dirigente ne imposta uno nuovo.

## Dati su Supabase

| Tabella | Contenuto |
|---|---|
| `gioco_squadre` | una riga per annata: codice invito, codice mister, impostazioni (tra cui `regole4`: la settimana da cui valgono le regole della versione 4) |
| `gioco_giocatori` | ragazzi: nome della rosa, soprannome, numero, avatar, stato (attesa · attivo · sospeso) |
| `gioco_eventi` | tutto ciò che succede: stella, mossa, sfida, obiettivo, autovalutazione, gg, combine, greencard |
| `gioco_trii` | fantasquadre di ogni settimana |
| `gioco_boss` | boss sconfitti, uno per mese |

Nessuna tabella è leggibile o scrivibile con la chiave pubblica: si passa solo dalle sei
funzioni, che controllano ogni volta link, codice o password e rispondono sempre
`{ok:true,…}` oppure `{errore:'…'}`. La rosa viene letta da `stato.dati.roster` dell'app partite.

I ragazzi vedono dei compagni solo soprannome, numero e avatar. Non vedono trofei, tempi
del combine né chi è il figlio del dirigente.

## Regole del gioco

**Trofei** (stessi valori in `gioco.html`, costante `T`, e in `gioco_danni()` nel database):

| Cosa | Trofei |
|---|---|
| stella del mister | 10, o 15 se è l'area della missione della settimana |
| mossa speciale sbloccata | 30 |
| sfida a casa (solo le prime 3 della settimana) | 5, +5 se batte il record |
| sfida della settimana (versione 4) | 5 in più, la prima volta che la fa in quella settimana |
| autovalutazione dell'obiettivo | 5, qualunque risposta |
| GG mandato / ricevuto | 2 / 3 |
| combine | 5 a prova, +10 se batte il record |
| Green Card | 50 |
| bonus fantasquadra | 10 a testa |
| boss del mese sconfitto | 20 a chi ha contribuito |

**Limiti**: una stella per area, per ragazzo, per settimana. Una mossa si sblocca una volta.
Un GG a settimana per ogni compagno della fantasquadra. Massimo 30 azioni al giorno per ragazzo.
L'autovalutazione si fa da venerdì a domenica, e non nello stesso giorno in cui si è scelto
l'obiettivo. Dalla versione 4 il +5 del record vale solo in una delle prime tre sfide della
settimana (il record resta comunque, e conta per medaglie e statistiche).

**Gradi**: Rookie 0, Fighter 150, Warrior 450, Champion 950, Legend 1500.
La strada dei trofei arriva a 2000 (costante `STRADA`): 31 tappe, al massimo 125 trofei tra
una e l'altra. Le tappe della versione 1 non sono state spostate; quelle nuove hanno `n:3`.

**Medaglie delle sfide a casa** (costante `MEDAGLIE`): bronzo, argento e oro per ogni sfida,
quando l'ha fatta in 2, 5 e 10 **giorni diversi** (ora di Roma). Contano i giorni, non il
risultato e non i giorni di fila: una medaglia presa non si perde. Non danno trofei. Sono
calcolate nell'app dagli eventi `sfida`, come i record.

**Statistiche**: Cuore = impegno, coraggio, rispetto, squadra. Piedi = motore, recupero, tocco,
visione. Ogni stella fa crescere la sua area (+3) e la statistica "piedi" legata alla frase
scelta (+2). Livello = 1 + punti/4. Livello 5 sblocca un titolo.

**Titoli**: i gradi, il livello 5 di una statistica, «Cartellino verde» con una Green Card,
«Tuttofare» con il bronzo in tutte le sfide (dodici, dalla versione 4), «Mai fermo» con l'oro in tre sfide, più i titoli
della strada («Bandiera granata» a 1875, «Never Give Up» a 2000).

**Missione della settimana**: a rotazione impegno (NON MOLLO), coraggio (CI PROVO),
rispetto (FAIR PLAY), squadra (ONE TEAM), calcolata dal numero della settimana.

**Fantasquadra**: creata al primo accesso di ogni settimana (lunedì), gruppi da 3 o 4
sorteggiati. Chi entra a settimana iniziata va nel gruppo più piccolo (nuovo gruppo se
tutti hanno già 3). Bonus se tutti, almeno in due, hanno una sfida e una stella.

**Boss**: energia = 150 × ragazzi attivi (minimo 300), modificabile nelle impostazioni.
Ogni trofeo del mese toglie energia: dalla versione 4 anche i bonus dei record (sfide e
combine) e il bonus fantasquadra, che conta nel mese in cui cade la domenica di quella
settimana. Solo il premio del boss stesso non conta. È sconfitto quando l'energia è finita **e** tutti i
ragazzi in squadra da almeno 7 giorni hanno fatto almeno una cosa nel mese.
Ha quattro fasi, a seconda dell'energia rimasta: sopra il 75% «È ancora in forma», sopra il
50% «Comincia a scricchiolare», sopra il 25% «È a metà: ha paura!», sotto «Sta per cedere!».
Ogni ragazzo vede quanta energia gli ha tolto lui nel mese (solo la sua).

**Settimana e mese** sono calcolati sull'ora di Roma.

## Grafica, movimento e suoni (versione 2)

Tutto è disegnato nel codice (SVG e CSS): nessuna immagine o file audio da scaricare.

| Cosa | Dove in `gioco.html` | Come funziona |
|---|---|---|
| Fighter | `fighterSVG()` | contorni spessi, luce a sinistra e ombra a destra (ritagli con id unici), scarpe con tacchetti. Facce: Sveglio, Felice, Grinta, Tranquillo, Furbo, Urlo |
| Fighter vivo | CSS `.corpo`, `.occhi-ap` | respira, sbatte gli occhi; toccato nella pagina Fighter salta (`data-act="salta"`) |
| Disegni di sfide e mosse | `DIS_SFIDA`, `DIS_MOSSA`, `disegno()` | schema con palla, piedi, frecce. Nelle tessere è fermo; nel foglio la palla corre lungo la freccia (`animateMotion`) |
| Trofei che contano | `contaTrofei()`, `volaPiu()` | quando i trofei salgono, «+N» vola sulla coppa in alto e il numero conta. Se la testata non si vede compare una pillola fissa in alto finché finisce |
| Feste | `festa()`, `prossimaFesta()` | una dopo l'altra: nuovo grado, «Sbloccato!» con i premi disegnati, «Novità per te», «Nuovo record!» |
| «Vediamo!» | `novita()` | all'apertura il telefono non lascia suonare finché non lo tocchi: prima compare il riassunto («3 stelle · 1 premio») e il tasto Vediamo! |
| Boss | `animaBoss()` | galleggia; se dall'ultima visita ha perso energia, la barra scende, il boss trema e compare il danno («−5») |
| Schede che entrano | classe `.entra` su `#app` | solo quando si cambia pagina, non a ogni aggiornamento |
| Suoni | `SUONI` | 16 suoni sintetizzati (Web Audio): tocco, pop, conteggio, moneta, stelle, fanfara, record, grado, colpo al boss, boing, fischio di inizio e fine del timer, ultimi 3 secondi, errore, GG, salvato |

**Regole dei suoni**
- Solo per i ragazzi (iscrizione, attesa, gioco). Mister e dirigente non sentono niente.
- L'altoparlante nella testata li spegne e li riaccende; la scelta resta sul telefono
  (`localStorage` `ngu:suoni`).
- Su iPhone tacciono con il tasto silenzioso, perché Safari tratta l'audio delle pagine come
  «ambient» ([WebKit](https://bugs.webkit.org/show_bug.cgi?id=237322)).
- Volume generale e limitatore in `catena()`: nessun suono può distorcere.

**Movimento ridotto**: chi ha attivato «riduci movimento» nel telefono vede tutto fermo
(nessuna animazione, nessun volo, numeri aggiornati subito). I suoni restano, se accesi.

**Personalizza**: l'anteprima del Fighter resta in alto mentre si scorrono le scelte, e il
foglio non torna più in cima a ogni tocco.

## Versione 3: più cose da fare, più premi

Niente immagini o file nuovi: tutto resta in `gioco.html`. Niente SQL nuovo.

| Cosa | Dove in `gioco.html` | Come funziona |
|---|---|---|
| Il Fighter fa le mosse | `MOSSA_ANIM`, `campetto()`, `faiMossa()`, `muovi()` | nel foglio di una mossa **sbloccata** c'è un campetto: il Fighter del ragazzo la fa con la palla, e la rifà a ogni tocco. Se la mossa è chiusa c'è solo il disegno |
| Festa «mossa sbloccata» | `festaMossa()` in `novita()` | quando il mister sblocca una mossa, alla prossima apertura il Fighter la fa vedere a schermo intero |
| Esultanze | `ESULTANZE`, `ES_ANIM`, `esulta()` | sei modi di festeggiare (Salto subito, gli altri sulla strada). Si sceglie in Personalizza; il Fighter esulta così quando lo tocchi e nelle feste |
| Gambe e braccia mobili | `fighterSVG()`, gruppi `ga-s`, `ga-d`, `br-s`, `br-d` | ogni gamba e ogni braccio è un gruppo: mosse ed esultanze li girano attorno all'anca e alla spalla. Il disegno fermo è lo stesso di prima |
| Medaglie | `calcola()` (`giorni`, `medaglie`, `storia`), `medaglia()`, `festaMedaglia()` | tre medaglie su ogni tessera; nel foglio della sfida anche quanti giorni mancano e il grafico dei propri ultimi 12 risultati (`grafico()`: in alto è sempre «meglio») |
| Prossimi traguardi | `traguardi()` | nella pagina Fighter, al massimo quattro righe: trofei che mancano al prossimo premio, sfide rimaste, GG da mandare, primo colpo al boss, medaglia più vicina, obiettivo da scegliere. Ogni riga porta alla pagina giusta |
| Strada più fitta | `STRADA` | 13 tappe nuove: 5 esultanze, 3 scarpe (arancio, viola, argento), 2 accessori (fascia da capitano, scaldacollo), 2 sfondi (campo, neve), 1 titolo |
| Boss a fasi | `faseBoss()`, `bossSVG()`, `mieiDanni()` | a metà energia il boss ha paura (occhi, goccia di sudore), a un quarto ha il cerotto e la bocca tremante. Tacche sulla barra, etichetta della fase, «tu gli hai tolto N» |
| Boss sconfitto | `festaBoss()` in `novita()` | schermata intera alla prima apertura dopo la sconfitta, con il premio di squadra |
| Livelli e titoli | `novita()`, `salita()` | una statistica che sale di livello compare tra le novità all'apertura; mentre si gioca è un avviso piccolo in alto |
| «Il gioco è cresciuto!» | `festaCresciuto()` | una volta sola (`localStorage` `ngu:v3:ID`) a chi giocava già: cosa c'è di nuovo e i premi nuovi che ha già guadagnato con i trofei di prima |
| Messaggio «Stelle messe» | `sStelle()`, azione `avvisaStelle` | in fondo alla scheda Stelle di mister e dirigente: testo pronto per il gruppo dei genitori, senza nomi né punteggi |

**Come sono scritti i movimenti.** Ogni mossa e ogni esultanza ha una durata e, per ogni parte
(corpo, braccia, gambe, tutto il Fighter, palla), una lista di passi `[momento da 0 a 1,
posizione]`. Le posizioni di una parte vanno scritte sempre con la stessa funzione (`_p` palla,
`_a` tutto il Fighter, `_c` corpo, `_r` braccio o gamba): se si mescolano, il telefono fa
scatti. Si usano le Web Animations del browser; con «riduci movimento» non parte niente.

**Attenzione al nome `.campo`**: è lo stile delle caselle di testo. Il campetto delle mosse si
chiama `.campetto`.

## Versione 4: sfide nuove e tre regole corrette

**Lo SQL è cambiato.** Va lanciato in Supabase › SQL Editor **prima** di approvare la pull
request. Si può rilanciare senza perdere dati (il collaudo lo fa due volte e conta le righe).

| Cosa | Dove | Come funziona |
|---|---|---|
| Sei sfide nuove | `SFIDE` e `DIS_SFIDA` in `gioco.html`, `gioco_ammessi('sfide')` nello SQL | Otto tra 2 bottiglie, Palleggi piede debole, Dentro-fuori, Tiro al bersaglio, Spola con la palla, Alza e stoppa. Finché il ragazzo non le prova hanno l'etichetta «nuova» |
| Sfida della settimana | `SFIDA_GIRO`, `sfidaSettimana()`; `gioco_sfida_settimana()` nello SQL | una sfida a rotazione ogni lunedì (dodici settimane, dodici sfide). In evidenza in cima alla pagina Sfide e tra i traguardi. 5 trofei in più la prima volta che la si fa nella settimana |
| Autovalutazione dal venerdì | `tSfide()`, `giornoSett()`; `gioco_giorno()` e `gioco_ragazzo()` nello SQL | i tasti «Fatto · Quasi · Non ancora» compaiono da venerdì a domenica, e non nel giorno in cui si è scelto l'obiettivo. Prima c'è scritto quando tornare. Il database rifiuta comunque (`presto`, `oggi`) |
| Record nelle prime tre sfide | `calcola()`; `gioco_danni()` nello SQL | il +5 del record vale solo se la sfida è una delle prime tre della settimana. La festa del record c'è sempre |
| Il boss conta ogni trofeo | `gioco_danni()` nello SQL; `calcola()` → `mesi` | record delle sfide, record del combine e bonus fantasquadra ora tolgono energia. `mieiDanni()` legge `mesi` da `calcola()`: un conto solo nell'app |
| «Sfide nuove!» | `festaSfideNuove()` | una volta sola (`localStorage` `ngu:v4:ID`) a chi giocava già |

**Da quando valgono le regole nuove sui trofei.** Il record nelle prime tre e la sfida della
settimana cambiano i trofei, quindi non valgono all'indietro: partono dalla settimana scritta
in `gioco_squadre.impostazioni.regole4`. Lo SQL la scrive da solo la prima volta che viene
lanciato: il lunedì successivo per le squadre che giocano già, subito per quelle attivate
dopo. Rilanciare lo SQL non la sposta. Se manca, le regole nuove non valgono (così in `R4_MAI`
nell'app e in `gioco_danni()`). Nessun ragazzo perde trofei già presi.
Le sfide nuove, l'autovalutazione dal venerdì e il boss che conta tutto valgono subito.

**Ordine giusto**: prima lo SQL, poi l'approvazione. Con lo SQL nuovo e l'app vecchia (i
minuti tra le due cose) chi prova ad autovalutarsi prima di venerdì vede «Qualcosa non va
(presto)». Con l'app nuova e lo SQL vecchio le sfide nuove darebbero errore.

**Il collaudo decide che giorno è.** `gioco_giorno()` dice il giorno della settimana a Roma.
I due collaudi la sostituiscono con una versione fissa (mercoledì, venerdì) per provare le
regole in qualunque giorno li si lanci; la funzione vera è provata a parte con date precise.

## Cosa succede da solo

Nessun programma pianificato da mantenere: è tutto calcolato quando qualcuno apre l'app.
Sorteggio delle fantasquadre, cambio della missione, boss sconfitto, sblocchi della strada,
livelli e titoli, elenco "chi non ha ancora stelle" per il mister, riepilogo settimanale.
Il ragazzo in attesa entra da solo appena approvato: la pagina si aggiorna ogni 15 secondi.

## Tutele

- Niente chat, niente testo libero tra ragazzi, niente foto: solo avatar e frasi pronte.
- Niente classifica individuale, niente casse a sorpresa, niente serie da non perdere,
  nessuna notifica ai ragazzi.
- Le medaglie non sono una serie: contano i giorni diversi, anche lontani tra loro, e non si
  perdono mai. I «prossimi traguardi» dicono cosa si può fare, senza scadenze e senza contare
  i giorni saltati.
- Il messaggio «Stelle messe» lo manda a mano il mister o il dirigente al gruppo dei
  genitori: il gioco non manda niente ai ragazzi.
- «Tu gli hai tolto N» sul boss lo vede solo il ragazzo: nessun confronto con i compagni.
- Il soprannome lo sceglie il ragazzo all'iscrizione; dopo l'approvazione lo cambia solo il dirigente.
- Le feste mostrano solo cose già guadagnate e sempre uguali per tutti: il «Vediamo!» non è
  una cassa a sorpresa. Animazioni e suoni festeggiano quello che il ragazzo ha fatto, non lo
  spingono a tornare.
- Il dirigente non può dare stelle o Green Card al proprio figlio (impostazione "Tuo figlio"):
  lo blocca il database, non solo l'app.
- **Elimina** cancella il ragazzo e tutti i suoi dati, compresi i GG ricevuti.
- Il consenso dei genitori e l'ok della società li gestisce Filippo.

## Come cambiare qualcosa

**Come si lavora.** Ogni modifica va su un ramo con una pull request: quello che arriva su
`main` è subito online per genitori e ragazzi. Nella stessa pull request: codice, test,
questo manuale (e la guida, se cambia ciò che vedono dirigente o mister). Se cambia lo SQL,
Filippo lo lancia in Supabase **prima** di approvare la pull request, perché la nuova app
potrebbe chiamare funzioni che il database vecchio non ha. Lo SQL va scritto in modo che si
possa rieseguire senza perdere dati.

- **Frasi delle stelle, mosse, sfide, obiettivi, frasi GG, strada, boss**: catalogo in cima
  allo script di `gioco.html`. Se cambi le *chiavi* di mosse, sfide, obiettivi, esiti o prove
  (non i nomi) vanno cambiate anche in `gioco_ammessi()` nello SQL. Massimo 10 frasi per area.
- **Nuova sfida o nuova mossa**: oltre al catalogo e a `gioco_ammessi()`, aggiungi il suo
  disegno in `DIS_SFIDA` o `DIS_MOSSA`. Senza, compare solo una palla e il collaudo lo segnala.
  Per una mossa aggiungi anche il movimento in `MOSSA_ANIM` (il collaudo segnala se manca) e
  guarda i fotogrammi in `test/shots/30-fotogrammi-mosse.png`.
  Per una sfida aggiungi la chiave anche al giro della sfida della settimana, nello stesso
  ordine in `SFIDA_GIRO` (app) e in `gioco_sfida_settimana()` (SQL, dove va cambiato anche il
  12 del resto); se è a tempo («meno è meglio», `verso:-1`) anche in
  `gioco_ammessi('sfide_meno')`. Il collaudo confronta app e database su tutto questo.
- **Nuova esultanza**: `ESULTANZE` (nome), `ES_ANIM` (movimento) e una tappa in `STRADA`.
- **Strada dei trofei**: si possono aggiungere tappe, mai spostare o togliere quelle che
  esistono: i ragazzi perderebbero premi già presi. Ogni premio deve esistere nel suo elenco
  (`KIT`, `SCARPE`, `SFONDI`, `CORNICI`, `ACCESSORI`, `ESULTANZE`) e avere il disegno in
  `icoPremio()`; uno sfondo ha anche lo stile `.sf-NOME`.
- **Medaglie**: giorni richiesti in `MEDAGLIE`. Abbassarli regala medaglie, alzarli le toglie.
- **Facce del Fighter**: elenco `OCCHI` e il `switch` delle facce in `fighterSVG()`. Le chiavi
  dell'avatar non sono controllate dallo SQL: niente da rilanciare.
- **Suoni**: elenco `LIB` dentro `SUONI`. Dopo una modifica ascolta i file del collaudo.
- **Valori dei trofei**: costante `T` in `gioco.html` e `gioco_danni()` nello SQL, insieme.
  Anche le *regole* sono in due posti: `calcola()` nell'app (trofei e `mesi`, l'energia tolta
  al boss) e `gioco_danni()` nello SQL. Il collaudo confronta i due conti per ogni ragazzo e
  ogni mese, con casi difficili: se cambi una regola da una parte sola, fallisce.
- **Server**: le righe `CONFIG` in cima a `gioco.html`, le stesse di `index.html`.

## Collaudo

Si lancia dalla cartella `test/`:

```
cd test
npm install
npm test        # database: 88 controlli, deve finire senza righe FALLITO
npm run e2e     # app su telefono simulato: 40 controlli, 54 schermate + l'immagine esportata in
                # test/shots/, nessuna riga FALLITO, "ERRORI: nessuno"
npm run anteprima   # facoltativo: nove Fighter diversi in test/shots/anteprima-fighter.png
```

- **Database** (`test-sql.mjs`): carica `sql/supabase-gioco.sql` in PostgreSQL 16 (PGlite)
  con una finta tabella `stato`/`chiavi` (password finte) e controlla permessi della chiave
  pubblica, PIN che si blocca, figlio, fantasquadre, boss, cancellazione completa.
- **App** (`e2e.mjs`): percorso intero su telefono simulato (390×844) con Chromium.
  Supabase è finto ma esegue le stesse funzioni SQL. Iscrizione, attesa e ingresso
  automatico, stelle, mosse, combine, sfide con timer e PIN, GG, personalizzazione,
  riepilogo e messaggi. Le schermate vanno guardate, non solo contate.
  Dalla versione 2 controlla anche: le tre feste all'apertura (Vediamo, grado, sbloccato), il
  contatore che arriva ai trofei veri, il record a schermo intero, il boss colpito dopo un GG,
  che ogni sfida e mossa abbia il suo disegno, che con l'altoparlante spento non parta nessun
  suono (conta gli oscillatori creati), che il mister non senta suoni, che con «riduci
  movimento» tutto stia fermo.
  Dalla versione 3 controlla anche: la festa della mossa nuova con il Fighter che si muove
  davvero, i prossimi traguardi, la medaglia di bronzo al secondo giorno, medaglie e grafico
  nel foglio della sfida, il contributo al boss uguale al conto del database, il campetto solo
  sulle mosse sbloccate, un movimento per ogni mossa ed esultanza, la strada in ordine con
  premi che esistono, l'esultanza scelta in anteprima e sulla card, «Il gioco è cresciuto!»
  una volta sola, la festa del boss sconfitto con i 20 trofei, il messaggio «Stelle messe»
  senza nomi, mosse ed esultanze ferme con «riduci movimento».
  Dalla versione 4 controlla anche: sfida della settimana (5 + 5 la prima volta), etichetta
  «nuova», record oltre le prime tre sfide senza trofei, obiettivo di mercoledì e di venerdì,
  app e database d'accordo su sfide, giro e mesi, energia del boss uguale per tutti i
  ragazzi e tutti i mesi, «Sfide nuove!» una volta sola. Il collaudo del database prova in più:
  giorno della settimana, giro delle dodici sfide, autovalutazione troppo presto o nello
  stesso giorno, regole nuove e regole di prima, record a tempo, bonus fantasquadra e record
  del combine nel boss, solo sei funzioni chiamabili, SQL rilanciato due volte senza perdere dati.
- **Fotogrammi**: `30-fotogrammi-mosse.png` e `30-fotogrammi-esultanze.png` mostrano ogni
  movimento fermato in quattro momenti, a grandezza vera. Vanno guardati dopo ogni modifica a
  `MOSSA_ANIM`, `ES_ANIM` o al disegno del Fighter.
- **Suoni**: il collaudo li registra in `test/shots/suoni/` (uno per suono più
  `tutti-i-suoni.wav`) e controlla che siano udibili e senza distorsione. Vanno ascoltati.
- Serve Playwright con Chromium già installato. Se manca e non si può installare, il
  collaudo dell'app non è fatto: va detto, non dato per buono.
- L'immagine del riepilogo è lo stesso canvas che si vede a schermo.

Ultimo collaudo: 16 novembre 2026 (versione 4), dalla cartella `test/` del repository. 88
controlli sul database superati; app: 40 controlli superati, 54 schermate più l'immagine
esportata, 16 suoni registrati, zero errori in console.

## Difetti corretti nella versione 4

Trovati nella valutazione del 15 novembre 2026, corretti il 16 novembre 2026.

- **Autovalutazione subito**: ora da venerdì a domenica, non nel giorno della scelta.
- **Record senza tetto**: ora il +5 vale solo in una delle prime tre sfide della settimana.
- **Il boss non contava tutti i trofei**: ora conta anche record e bonus fantasquadra.

Ancora fuori, da decidere con Filippo: la missione di fantasquadra a somma («in tre fate 150
tocchi»). Chi salta il fine settimana non può autovalutarsi per quella settimana: è voluto,
ma se pesa si può allargare al lunedì successivo (servirebbe SQL).

## Lasciato fuori dalla versione 1 (di proposito)

- Conteggio di una variabile in partita (recuperi, rientri…): previsto per la versione 2.
- Collegamento dall'app partite al gioco: `index.html` non è stato modificato.
- Notifiche push: il gioco non ne manda.
- Sfide a casa, mosse e prove del combine create o modificate dal mister dall'app: chiesto da
  Filippo il 2 novembre 2026, rimandato a dopo il primo periodo di uso. Servirà una tabella
  nuova, il controllo in `gioco_ammessi()` da adattare e una pagina nell'app del mister.
