# Gioco NEVER GIVE UP — manuale tecnico

Versione 1, 1 novembre 2026. Online dal 2 novembre 2026. Da leggere prima di ogni modifica al gioco.
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
- **Valori dei trofei**: costante `T` in `gioco.html` e `gioco_danni()` nello SQL, insieme.
- **Server**: le righe `CONFIG` in cima a `gioco.html`, le stesse di `index.html`.

## Collaudo

Si lancia dalla cartella `test/`:

```
cd test
npm install
npm test        # database: 72 controlli, deve finire senza righe FALLITO
npm run e2e     # app su telefono simulato: 29 schermate in test/shots/, "ERRORI: nessuno"
```

- **Database** (`test-sql.mjs`): carica `sql/supabase-gioco.sql` in PostgreSQL 16 (PGlite)
  con una finta tabella `stato`/`chiavi` (password finte) e controlla permessi della chiave
  pubblica, PIN che si blocca, figlio, fantasquadre, boss, cancellazione completa.
- **App** (`e2e.mjs`): percorso intero su telefono simulato (390×844) con Chromium.
  Supabase è finto ma esegue le stesse funzioni SQL. Iscrizione, attesa e ingresso
  automatico, stelle, mosse, combine, sfide con timer e PIN, GG, personalizzazione,
  riepilogo e messaggi. Le schermate vanno guardate, non solo contate.
- Serve Playwright con Chromium già installato. Se manca e non si può installare, il
  collaudo dell'app non è fatto: va detto, non dato per buono.
- L'immagine del riepilogo è lo stesso canvas che si vede a schermo.

Ultimo collaudo: 2 novembre 2026, dalla cartella `test/` del repository. 72 controlli sul
database superati, 29 schermate, zero errori in console.

## Lasciato fuori dalla versione 1 (di proposito)

- Conteggio di una variabile in partita (recuperi, rientri…): previsto per la versione 2.
- Collegamento dall'app partite al gioco: `index.html` non è stato modificato.
- Notifiche push: il gioco non ne manda.
