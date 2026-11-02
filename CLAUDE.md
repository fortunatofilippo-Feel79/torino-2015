# torino-2015: istruzioni per Claude

Repository delle app di Filippo, dirigente accompagnatore dell'annata 2015 del Torino Club MP
(A.S.C.D. Torino Club Gallarate). Colori: granata #922F29 e bianco. Rispondi sempre in
italiano e spiega in parole semplici cosa hai cambiato e cosa deve fare lui.

Il sito è pubblicato con GitHub Pages: **quello che arriva su `main` è subito online** per
genitori e ragazzi. Il repository è **pubblico**.

## Cosa c'è

| File | Cosa |
|---|---|
| `index.html`, `societa.html`, `sw.js` | app partite |
| `gioco.html` | gioco NEVER GIVE UP per i ragazzi |
| `sql/supabase-gioco.sql` | database del gioco su Supabase |
| `docs/manuale-gioco.md` | manuale tecnico del gioco |
| `docs/guida-gioco.md` | guida d'uso per dirigente e mister |
| `test/` | collaudo del gioco |

## Come lavorare

- Mai push diretto su `main`: lavora su un ramo e apri una pull request. La approva Filippo.
- Prima di toccare il gioco leggi `docs/manuale-gioco.md`.
- Collauda davvero prima di consegnare: `cd test && npm install && npm test`, poi
  `npm run e2e`, e guarda le schermate in `test/shots/`. Se il collaudo dell'app non può
  girare, dillo chiaramente: non scrivere che l'app è collaudata.
- Le immagini esportate devono essere identiche a quello che si vede a schermo.
- Nella stessa pull request aggiorna il manuale e, se cambia ciò che vedono dirigente o
  mister, la guida.
- Lo SQL non si applica da solo. Se lo cambi, deve poter essere rieseguito senza perdere
  dati, e nella pull request scrivi a Filippo di lanciarlo in Supabase › SQL Editor
  **prima** di approvare.
- I valori dei trofei si cambiano insieme: costante `T` in `gioco.html` e `gioco_danni()`
  nello SQL. Le chiavi di mosse, sfide, obiettivi, esiti e prove anche in `gioco_ammessi()`.
- Se decidi di non toccare qualcosa, dillo. Una modifica a metà lasciata in silenzio è
  peggio dell'errore.

## Principi del gioco (non cambiarli senza chiedere a Filippo)

- Contano comportamenti e impegno, mai gol, risultati o minuti giocati.
- Niente chat, testo libero tra ragazzi, foto, classifiche individuali, casse a sorpresa,
  serie da non perdere, notifiche ai ragazzi.
- Il dirigente non dà stelle né Green Card al proprio figlio: lo blocca il database.
- Le tabelle `gioco_*` non si leggono con la chiave pubblica: solo le sei funzioni
  pubbliche, che controllano link, codice o password a ogni chiamata.
- Nei testi per genitori e mister non promettere miglioramenti tecnici.

## App partite

Se il compito riguarda il gioco, non toccare `index.html`, `societa.html` e `sw.js`. Il
manuale tecnico dell'app partite non è ancora in questo repository: prima di modificarla,
chiedi a Filippo.

## Mai nel repository

Password di scrittura, codici aiutante, password amministratore, codice mister, codice
d'invito, link personali dei ragazzi. La chiave publishable di Supabase può stare: è pubblica.
