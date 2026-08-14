# Sezione 02 — Dashboard e triage del workspace

## Fonti da leggere

- `apps/web/src/components/dashboard/DashboardHome.tsx`
- `apps/web/src/components/dashboard/DashboardMetrics.tsx`
- `apps/web/src/components/dashboard/DashboardInsights.tsx`
- `apps/web/src/components/dashboard/DashboardRecentActivity.tsx`
- `apps/web/src/components/dashboard/DashboardQuickActions.tsx`
- `apps/web/src/components/dashboard/dashboardSnapshot.ts`

## Prompt pronto da incollare

Ridisegna la Dashboard di repo-control come una superficie di **triage operativo**, non come una raccolta di KPI. In meno di dieci secondi lo sviluppatore deve capire cosa richiede attenzione, quale repository aprire e quale azione è sensata.

### Decisioni che la schermata deve accelerare

- Quali repository sono pronti e quali sono dirty, behind, ahead o diverged?
- Dove sono concentrate le modifiche locali?
- C'è un problema Docker o un container unhealthy?
- Qual è l'attività recente rilevante?
- Quale repository conviene aprire adesso?

### Funzioni da preservare

- Totale repository e preferiti.
- Repository sani/pronti e repository da controllare.
- Modifiche staged, unstaged e untracked aggregate e per repository.
- Ahead/behind/diverged.
- Container e gruppi Docker attivi.
- Insight cliccabili che aprono il repository corretto.
- Attività recente con commit e accesso alle sezioni correlate.
- Quick action verso Repository, Docker e Preferiti.
- Empty state quando nessun workspace è selezionato.
- Citazione locale opzionale: può diventare più discreta, contestuale o essere sostituita da un elemento con maggiore utilità, ma motiva la scelta.

### Direzione di layout

- Parti da una **attention queue** ordinata per severità e impatto; le metriche devono supportarla, non competere con essa.
- Sostituisci il “card soup” con sezioni, bande, righe dati o un canvas asimmetrico con una gerarchia dominante.
- Distingui salute, carico di modifiche e attività nel linguaggio visivo.
- Mostra proporzioni e trend solo quando aiutano una decisione; evita donut chart usati come decorazione.
- Prevedi un livello overview e un'espansione rapida per repository senza aprire subito il workspace completo.
- Usa numeri, label e microcopy leggibili anche con 0, 1, 12 e 50 repository.

### Stati obbligatori

- tutto pulito;
- più repository con problemi simultanei;
- nessun commit recente;
- Docker assente o spento;
- workspace vuoto;
- scansione/refresh;
- dati Git disponibili ma Docker parzialmente fallito;
- repository con nomi e path lunghi.

### Deliverable specifici

- Due proposte di information architecture, di cui almeno una non basata su griglia di card.
- High fidelity con dataset healthy e dataset problematico.
- Interaction detail dell'attention queue e apertura repository.
- Sistema per severità: critical, action needed, informative, healthy.
- Specifica responsive che conservi prima le priorità e poi le metriche.
- Criterio misurabile: da un cold start, un utente deve individuare il repository più urgente con non più di una scansione e un click.

Non trasformare la Dashboard in un report di management: è la home operativa di chi deve lavorare sul codice.
