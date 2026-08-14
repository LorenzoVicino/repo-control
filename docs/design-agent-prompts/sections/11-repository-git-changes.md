# Sezione 11 — Repository / Modifiche Git

## Fonti da leggere

- `apps/web/src/components/project/ChangesPanel.tsx`
- `apps/web/src/api/projects.ts`
- `apps/web/src/types/git.ts`
- `apps/web/src/components/shared/CommandOutput.tsx`

## Prompt pronto da incollare

Ridisegna la tab Modifiche come un Git workbench completo ma focalizzato: staging, diff, commit e sincronizzazione devono essere rapidi e sicuri senza replicare tutta la complessità di un Git client desktop.

### Funzioni da preservare

- Stato working tree, tracking, staged/unstaged e conteggi.
- Liste separate staged e unstaged/untracked.
- Stage/unstage per file e bulk.
- Selezione file e diff inline testuale.
- Diff staged/unstaged con summary file, additions, deletions e binary count.
- Righe diff con numeri old/new, hunk, added/deleted/context e file binario.
- Commit message e commit dei file staged.
- Pull, push e indicatori ahead/behind.
- Stash changes, lista stash e pop.
- Output e errore delle azioni.
- Loading, clean state, diff assente e file molto grandi.

### Obiettivo UX

L'utente deve poter capire **cosa cambierà nel prossimo commit**, prepararlo e sincronizzarlo senza perdere il rapporto tra file selezionato, lato staged/unstaged e comando che verrà eseguito.

### Requisiti di design

- Esplora un master-detail ridimensionabile: file rail + diff + commit/actions, con fallback laptop a due pannelli.
- Mantieni staged e unstaged chiaramente distinti anche quando un file esiste in entrambi.
- Usa status letter/code (`M`, `A`, `D`, `R`, `?`) con label accessibile e colore semantico.
- Il diff deve avere tipografia mono, numeri di riga allineati, contrasto AA e selezione del testo agevole.
- Il commit composer deve mostrare staged file count e bloccare/esplicitare l'assenza di messaggio o file.
- Pull/Push non devono competere visivamente con Commit; chiarisci precondizioni e divergenza.
- Stash è secondario ma scopribile, con storico e Pop chiaramente scoped.
- Non nascondere tutte le azioni dietro menu kebab; quelle frequenti devono essere dirette.

### Stati obbligatori

- clean;
- solo unstaged, solo staged e file parzialmente staged;
- untracked, deleted, renamed e binary;
- diff loading/error/empty/large;
- commit running/success/failure;
- ahead, behind e diverged;
- stash vuoto e con più entry.

### Deliverable specifici

- High fidelity desktop e laptop con diff reale multilinea.
- Variante mobile consultiva con azioni Git essenziali e conferme sicure.
- Component anatomy per file row, section header, diff line, hunk header, summary, commit composer e stash row.
- Flusso `select → inspect → stage → commit → push` annotato.
- Focus model e shortcut proposte senza conflitti con il browser.
