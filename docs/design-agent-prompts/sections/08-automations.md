# Sezione 08 — Automazioni visuali

## Fonti da leggere

- `apps/web/src/components/automation/AutomationPage.tsx`
- `apps/web/src/components/automation/AutomationWorkflowEditor.tsx`
- `apps/web/src/components/automation/AutomationNodePalette.tsx`
- `apps/web/src/components/automation/AutomationNodeInspector.tsx`
- `apps/web/src/components/automation/AutomationNode.tsx`
- `apps/web/src/components/automation/AutomationRunHistory.tsx`
- `apps/web/src/components/automation/AutomationExecutionDialog.tsx`
- `apps/web/src/components/automation/AutomationRunDialog.tsx`
- `apps/web/src/components/automation/automationNodeCatalog.tsx`
- `apps/web/src/types/workflows.ts`

## Prompt pronto da incollare

Ridisegna Automazioni come un editor visuale professionale per workflow locali Git, Docker e terminale. Il design deve rendere il flusso comprensibile, validabile e sicuro prima dell'esecuzione. Non imitare un generico diagram editor né strumenti no-code consumer.

### Funzioni da preservare

- Selezione, ricerca, creazione ed eliminazione workflow.
- Template iniziali e workflow vuoto.
- Nome, descrizione, stato dirty, salvataggio ed errore.
- Due viste: Editor ed Esecuzioni/Cronologia.
- Canvas React Flow con zoom, pan, controls, connessioni lineari e nodi selezionabili.
- Libreria nodi cercabile e raggruppata: Avvio, Input, Repository, Git, Docker, Comandi, Output.
- Inspector contestuale per configurare il nodo.
- Validazione del grafo e messaggi actionable.
- Dry-run e Run; salvataggio automatico prima del run quando necessario.
- Input di testo runtime con required/default/multiline.
- Run pending/running/success/warning/failed/cancelled/interrupted.
- Polling live, step per repository, stdout/stderr, comandi, durata e summary.
- Cancellazione di un run attivo e storico persistente.
- Conferma per modifiche non salvate e azioni distruttive.

### Problema da risolvere

L'editor deve bilanciare quattro livelli che oggi rischiano di competere: workflow identity, authoring canvas, node configuration e run observability. Progetta una gerarchia che non costringa a chiudere e riaprire pannelli continuamente.

### Requisiti di design

- Considera un layout desktop a canvas centrale con pannelli dock/overlay; dimostra il comportamento a 1280 px.
- Differenzia visivamente nodi di controllo, input, selezione, azione rischiosa e output senza usare colori eccessivi.
- Mostra porte/connessioni e ordine di esecuzione con precisione; il grafo supporta una catena lineare, non branching arbitrario.
- Lo stato selezionato, invalid, running, succeeded, failed e skipped del nodo deve essere progettato.
- Dry-run deve sembrare un'ispezione sicura e non una versione minore del Run.
- Prima del Run mostra scope: workflow, repository selezionati, input richiesti e modifiche da salvare.
- Il run dialog deve funzionare come live execution inspector: step progressivi, output espandibile, cancellation e chiusura senza interrompere.
- La cronologia deve permettere confronto mentale tra run recenti senza diventare una tabella illeggibile.
- Progetta empty canvas, workflow invalido, nessun risultato nella node library e run interrotto dal restart.

### Dataset obbligatorio

Usa un workflow realistico:

`Manual trigger → Release name input → Select favorites → Filter clean → Git fetch → Terminal tests → Docker rebuild → Summary`

Mostra almeno un repository skipped e un test fallito in una variante.

### Deliverable specifici

- Canvas completo desktop e laptop.
- Mobile in modalità consultazione/esecuzione; se l'authoring completo non è credibile, specifica chiaramente il subset supportato.
- Component anatomy per node, edge, library item, inspector field, validation banner, run step e history item.
- Journey Create → Configure → Invalid → Fix → Dry-run → Run → Cancel/Complete → History.
- Shortcut e focus model per aggiunta nodo, selezione, delete, save, dry-run e run.
- Specifica motion per connessioni, pannelli e progresso compatibile con reduced motion.

Il risultato deve far sentire l'utente più sicuro nell'eseguire un workflow reale di quanto si sentirebbe leggendo uno script shell opaco.
