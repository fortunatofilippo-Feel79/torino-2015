# Gioco NEVER GIVE UP — manuale tecnico

Versione 2, 2 novembre 2026 (grafica, movimento e suoni). Versione 1 online dal 2 novembre 2026.
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
| `gioco_squadre` | una riga per annata: codice invito, codice mister, impostazioni |
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
| autovalutazione dell'obiettivo | 5, qualunque risposta |
| GG mandato / ricevuto | 2 / 3 |
| combine | 5 a prova, +10 se batte il record |
| Green Card | 50 |
| bonus fantasquadra | 10 a testa |
| boss del mese sconfitto | 20 a chi ha contribuito |

**Limiti**: una stella per area, per ragazzo, per settimana. Una mossa si sblocca una volta.
Un GG a settimana per ogni compagno della fantasquadra. Massimo 30 azioni al giorno per ragazzo.

**Gradi**: Rookie 0, Fighter 150, Warrior 450, Champion 950, Legend 1500.
La strada dei trofei arriva a 2000 (costante `STRADA`).

**Statistiche**: Cuore = impegno, coraggio, rispetto, squadra. Piedi = motore, recupero, tocco,
visione. Ogni stella fa crescere la sua area (+3) e la statistica "piedi" legata alla frase
scelta (+2). Livello = 1 + punti/4. Livello 5 sblocca un titolo.

**Missione della settimana**: a rotazione impegno (NON MOLLO), coraggio (CI PROVO),
rispetto (FAIR PLAY), squadra (ONE TEAM), calcolata dal numero della settimana.

**Fantasquadra**: creata al primo accesso di ogni settimana (lunedì), gruppi da 3 o 4
sorteggiati. Chi entra a settimana iniziata va nel gruppo più piccolo (nuovo gruppo se
tutti hanno già 3). Bonus se tutti, almeno in due, hanno una sfida e una stella.

**Boss**: energia = 150 × ragazzi attivi (minimo 300), modificabile nelle impostazioni.
Ogni trofeo del mese toglie energia. È sconfitto quando l'energia è finita **e** tutti i
ragazzi in squadra da almeno 7 giorni hanno fatto almeno una cosa nel mese.

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

## Cosa succede da solo

Nessun programma pianificato da mantenere: è tutto calcolato quando qualcuno apre l'app.
Sorteggio delle fantasquadre, cambio della missione, boss sconfitto, sblocchi della strada,
livelli e titoli, elenco "chi non ha ancora stelle" per il mister, riepilogo settimanale.
Il ragazzo in attesa entra da solo appena approvato: la pagina si aggiorna ogni 15 secondi.

## Tutele

- Niente chat, niente testo libero tra ragazzi, niente foto: solo avatar e frasi pronte.
- Niente classifica individuale, niente casse a sorpresa, niente serie da non perdere,
  nessuna notifica ai ragazzi.
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
- **Facce del Fighter**: elenco `OCCHI` e il `switch` delle facce in `fighterSVG()`. Le chiavi
  dell'avatar non sono controllate dallo SQL: niente da rilanciare.
- **Suoni**: elenco `LIB` dentro `SUONI`. Dopo una modifica ascolta i file del collaudo.
- **Valori dei trofei**: costante `T` in `gioco.html` e `gioco_danni()` nello SQL, insieme.
- **Server**: le righe `CONFIG` in cima a `gioco.html`, le stesse di `index.html`.

## Collaudo

Si lancia dalla cartella `test/`:

```
cd test
npm install
npm test        # database: 72 controlli, deve finire senza righe FALLITO
npm run e2e     # app su telefono simulato: 38 schermate + l'immagine esportata in test/shots/,
                # nessuna riga FALLITO, "ERRORI: nessuno"
npm run anteprima   # facoltativo: sei Fighter diversi in test/shots/anteprima-fighter.png
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
- **Suoni**: il collaudo li registra in `test/shots/suoni/` (uno per suono più
  `tutti-i-suoni.wav`) e controlla che siano udibili e senza distorsione. Vanno ascoltati.
- Serve Playwright con Chromium già installato. Se manca e non si può installare, il
  collaudo dell'app non è fatto: va detto, non dato per buono.
- L'immagine del riepilogo è lo stesso canvas che si vede a schermo.

Ultimo collaudo: 2 novembre 2026 (versione 2), dalla cartella `test/` del repository. 72
controlli sul database superati; app: 14 controlli superati, 38 schermate più l'immagine
esportata, 16 suoni registrati, zero errori in console.

## Lasciato fuori dalla versione 1 (di proposito)

- Conteggio di una variabile in partita (recuperi, rientri…): previsto per la versione 2.
- Collegamento dall'app partite al gioco: `index.html` non è stato modificato.
- Notifiche push: il gioco non ne manda.
- Sfide a casa, mosse e prove del combine create o modificate dal mister dall'app: chiesto da
  Filippo il 2 novembre 2026, rimandato a dopo il primo periodo di uso. Servirà una tabella
  nuova, il controllo in `gioco_ammessi()` da adattare e una pagina nell'app del mister.
