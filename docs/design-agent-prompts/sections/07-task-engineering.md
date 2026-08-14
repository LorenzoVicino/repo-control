# Sezione 07 — Task engineering assistito da AI

## Fonti da leggere

- `apps/web/src/components/task/TaskEngineeringPage.tsx`
- `apps/web/src/components/task/TaskPlanningComposer.tsx`
- `apps/web/src/components/task/TaskPlanReview.tsx`
- `apps/web/src/components/task/TaskWorkbench.tsx`
- `apps/web/src/components/task/ImplementationPanel.tsx`
- `apps/web/src/components/task/TaskList.tsx`
- `apps/web/src/types/brain.ts`

## Prompt pronto da incollare

Ridisegna Task engineering come un flusso trasparente e controllabile che porta da un risultato desiderato a un piano AI revisionato, approvato e implementato. Non deve sembrare una normale chat con un pulsante “generate”.

### Modello mentale da comunicare

`Intento → Pianificazione in sola lettura → Review → Gate approvati → Implementazione → Verifiche`

L'utente deve sempre capire in quale fase si trova, quali repository sono coinvolti, cosa è modificabile e quale azione abilita la fase successiva.

### Funzioni da preservare

- Selezione repository principale.
- Lista task con tipo, provenienza AI/manuale e stato.
- Creazione di un nuovo task.
- Composer con obiettivo, profilo e repository aggiuntivi di contesto.
- Planning Claude Code in corso, cancellabile e potenzialmente lungo.
- Review del piano con domande/opzioni, raccomandazione, titolo, problema, motivazione, assunzioni e richiesta di revisione.
- Creazione del task dal piano approvato.
- Workbench con repository principale e context repository.
- Fasi/gate di design, implementazione e verifica con contenuti editabili e approvazione/riapertura.
- Implementation panel con istruzione aggiuntiva, comandi di verifica, context pack, run e risultati dei check.
- Errori, run fallito, task completato e stati intermedi.

### Obiettivo UX

Ridurre l'ansia da automazione AI mostrando confini, input, dipendenze, approvazioni e prove. Il design deve premiare la revisione critica, non spingere l'utente a cliccare “Approva” il più velocemente possibile.

### Requisiti di design

- Progetta un layout desktop a tre zone solo se resta leggibile a 1280 px; in alternativa usa list + workbench con rail di fase.
- La fase corrente e i gate devono essere una struttura primaria, non chip disperse.
- Distingui contenuto prodotto dall'AI, contenuto modificato dall'utente e output di esecuzione.
- Mostra i repository di contesto vicino a ogni azione che può usarli.
- Il planning lungo deve comunicare progresso senza inventare percentuali false.
- La review deve supportare lettura lunga, domande e modifica senza diventare un form infinito.
- I comandi di verifica richiedono visualizzazione monospaziata, esito individuale e output espandibile.
- Progetta recovery per piano fallito, planning cancellato, gate riaperto e implementazione fallita.

### Stati obbligatori

- nessun task, lista con task misti, selezione task;
- composer vuoto, valido e con contesto multi-repo;
- planning pending/running/cancelled/failed/completed;
- review con domande, senza domande e con richiesta di modifica;
- gate draft/approved/reopened;
- run implementation running/succeeded/failed con check parziali.

### Deliverable specifici

- Journey completo su 6–8 frame collegati.
- Anatomia `TaskRail`, `PlanningProgress`, `ReviewDocument`, `ApprovalGate`, `ContextPack` e `VerificationResult`.
- Regole per contenuti lunghi, sticky action e confronto prima/dopo una revisione.
- Mobile: consultazione, risposta alle domande e approvazione sicura; non comprimere il workbench desktop in tre colonne minuscole.
- Criterio di successo: in ogni frame l'utente deve poter spiegare cosa farà il prossimo click e quale stato diventerà irreversibile o rieseguibile.
