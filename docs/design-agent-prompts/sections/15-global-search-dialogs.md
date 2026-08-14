# Sezione 15 — Ricerca globale, dialog e feedback trasversale

## Fonti da leggere

- `apps/web/src/components/dashboard/RepositoryCommandPalette.tsx`
- `apps/web/src/components/dashboard/AppUpdateDialog.tsx`
- `apps/web/src/components/automation/AutomationExecutionDialog.tsx`
- `apps/web/src/components/automation/AutomationRunDialog.tsx`
- `apps/web/src/components/automation/CreateAutomationDialog.tsx`
- `apps/web/src/components/shared/CommandOutput.tsx`
- tutti i `Dialog` presenti in `apps/web/src/components/`

## Prompt pronto da incollare

Progetta un sistema coerente per ricerca globale, dialog, conferme, progress e output di comando. Queste superfici attraversano tutte le sezioni e determinano la percezione di affidabilità del prodotto.

### Superfici da coprire

- Command palette repository con `Ctrl+P`, ricerca, status e selezione da tastiera.
- Cambio workspace con `Ctrl+O` e feedback del picker nativo.
- Creazione workflow da template.
- Raccolta input prima di dry-run/run.
- Run inspector live con step, output e cancellazione.
- Conferma modifiche non salvate.
- Eliminazione workflow e altre azioni distruttive.
- Update applicazione.
- Output di comandi Git/Docker/terminale con success, error e copia.
- Alert e snackbar per errori locali o parziali.

### Obiettivo UX

Ogni overlay deve rendere evidente:

1. perché è apparso;
2. quale contesto sta modificando;
3. quale azione è primaria;
4. se chiuderlo interrompe o lascia continuare il lavoro;
5. come recuperare da un errore.

### Requisiti di design

- Definisci quando usare modal dialog, non-modal inspector, popover, command palette, inline alert e toast.
- La command palette deve essere rapidissima: autofocus, frecce, Enter, Escape, status leggibili e path completi accessibili.
- Non disabilitare la chiusura di un dialog lungo se l'operazione può continuare in background; comunica la semantica.
- Le conferme distruttive devono nominare target e conseguenza, con primary/secondary action non ambigue.
- Le azioni non distruttive ma ad alto impatto devono mostrare scope e precondizioni, non richiedere modalità cerimoniale per tutto.
- L'output comando deve distinguere comando, stdout, stderr, exit code, durata e azioni Copy/Close.
- Progetta focus trap, ritorno del focus, scroll lock, mobile full-screen e contenuti lunghi.
- Riduci la dipendenza da toast effimeri per informazioni necessarie al recupero.

### Stati obbligatori

- command palette vuota, con risultati, senza risultati e loading;
- dialog idle, submitting, background-running, failed e completed;
- errore recuperabile/non recuperabile;
- azione cancellata dall'utente;
- output corto/lungo e con stderr;
- contenuto che supera l'altezza viewport.

### Deliverable specifici

- Decision tree per scegliere il pattern di feedback.
- Libreria `CommandPalette`, `ConfirmationDialog`, `ExecutionInspector`, `CommandResult`, `InlineAlert` e `Toast` con varianti.
- Specifica motion e reduced-motion.
- Focus order e keyboard contract.
- Esempi completi in italiano, senza lorem ipsum.
