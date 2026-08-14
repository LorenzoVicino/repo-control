# Sezione 13 — Repository / Terminale

## Fonti da leggere

- `apps/web/src/components/project/TerminalPanel.tsx`
- `apps/web/src/api/projects.ts`
- `apps/web/src/types/common.ts`
- `apps/server/src/routes/terminalRoutes.ts`

## Prompt pronto da incollare

Ridisegna la tab Terminale come command runner persistente e scoped al repository. Non è un emulatore terminale completo: esegue un comando alla volta, conserva il transcript mentre il repository resta aperto e permette stop, clear e suggerimenti persistenti.

### Funzioni da preservare

- Nome repository e path/working directory.
- Stato `ready` o `running`.
- Transcript iniziale, comandi, stdout, stderr, exit code, durata e timestamp.
- Input singolo con prompt visivo.
- Esecuzione via click/Enter.
- Stop del processo attivo con kill del process tree.
- Clear transcript con conferma o gesto non ambiguo.
- Storico/suggerimenti ordinati per repository e frequenza.
- Navigazione suggerimenti da tastiera.
- Transcript mantenuto quando si passa ad altra tab o repository aperto.
- Errori, cancellazione e comando concorrente rifiutato.

### Obiettivo UX

Far sentire sempre l'utente dentro il repository corretto e distinguere chiaramente input, comando attivo, output completato e cancellazione. La persistenza deve essere percepibile, non sorprendente.

### Requisiti di design

- Working directory sempre leggibile e copiabile, ma non dominante.
- Terminal surface con contrasto elevato e selezione/copia del testo; evita la caricatura “green text hacker”.
- Prompt, command, stdout, stderr e metadata devono avere ruoli tipografici diversi.
- Stato running deve includere elapsed time e Stop prominente ma non distruttivo per errore.
- Clear deve dichiarare che rimuove solo il transcript visibile, non lo storico suggerimenti, se questo rispecchia il comportamento.
- Progetta output di 3 righe e 3.000 righe, errori multilinea e ANSI color.
- Suggerimenti non devono coprire il comando o impedire l'uso da tastiera.
- Spiega visivamente che cambiare tab non interrompe il processo.

### Stati obbligatori

- primo utilizzo;
- ready con transcript;
- autocomplete aperto;
- running, stop pending e cancelled;
- success, non-zero exit, timeout e spawn error;
- clear confirmation;
- comando rifiutato perché uno è già attivo.

### Deliverable specifici

- High fidelity con transcript realistico success/failure.
- Anatomia `TerminalHeader`, `TranscriptEntry`, `CommandPrompt`, `SuggestionMenu` e `ProcessControl`.
- Specifica auto-scroll e comportamento quando l'utente ha scrollato verso l'alto.
- Responsive desktop/laptop/mobile e focus/shortcut model.
