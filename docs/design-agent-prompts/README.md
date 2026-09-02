# repo-control — Design agent prompt pack

Questa cartella contiene prompt pronti da passare a un agente di product/UI design per ripensare repo-control senza perdere le funzioni operative già esistenti.

## Obiettivo

Il redesign deve far evolvere repo-control da una dashboard SaaS ordinata ma generica a un vero **developer operations workbench**: riconoscibile, rapido da leggere, credibile per chi lavora ogni giorno con Git, Docker, terminali e agenti AI.

Il problema visivo da risolvere non è la mancanza di decorazione. L'interfaccia attuale soffre soprattutto di:

- gerarchia debole tra stato, rischio e azione;
- troppe superfici equivalenti e conseguente effetto “card grid”;
- tipografia piccola e poco caratterizzante;
- identità di prodotto poco distinta dai normali admin dashboard;
- shell, dashboard e workspace repository che non sembrano ancora parti dello stesso strumento;
- dati operativi espressi soprattutto come chip, senza abbastanza ritmo, contrasto o progressive disclosure.

## Come usare i prompt

1. Passa prima [`00-master-brief.md`](00-master-brief.md) all'agente.
2. Usa [`01-creative-directions.md`](01-creative-directions.md) per ottenere tre direzioni visive globali realmente differenti.
3. Scegli una direzione e assegnale un nome stabile, per esempio `Precision Workbench`.
4. Per ogni schermata, invia all'agente il master brief, la direzione scelta e il relativo file nella cartella [`sections`](sections).
5. Chiedi all'agente di mantenere una sola libreria condivisa di token e componenti mentre procede tra le sezioni.
6. Usa [`99-cross-section-review.md`](99-cross-section-review.md) alla fine per controllare che il risultato sembri un prodotto unico.

Ogni prompt di sezione è autosufficiente sul piano funzionale, ma presuppone che la direzione visiva e i token siano già stati scelti.

## Ordine consigliato

| Fase | File | Perché viene prima |
| --- | --- | --- |
| 1 | `00-master-brief.md` | Stabilisce prodotto, utenti, vincoli e qualità attesa. |
| 2 | `01-creative-directions.md` | Evita di abbellire subito la soluzione attuale e forza alternative vere. |
| 3 | `sections/01-app-shell-navigation.md` | La shell determina densità, navigazione e comportamento di tutte le pagine. |
| 4 | `sections/02-dashboard-overview.md` | Fissa il linguaggio di sintesi e triage del workspace. |
| 5 | `sections/03-repositories-catalog.md` | Fissa il linguaggio delle collezioni di repository. |
| 6 | `sections/09-repository-workspace-shell.md` | Definisce il passaggio dal workspace globale al lavoro su un singolo repository. |
| 7 | `sections/10`–`14` | Disegna le tab operative del repository. |
| 8 | `sections/05`, `06`, `08` | Estende il sistema a Docker globale, agenti e automazioni. La `07` è parcheggiata. |
| 9 | `sections/15-global-search-dialogs.md` | Consolida overlay, ricerca e azioni trasversali. |
| 10 | `99-cross-section-review.md` | Audit finale di coerenza e completezza. |

## Inventario dei file di sezione

- `01-app-shell-navigation.md` — sidebar, app bar, workspace picker, temi e navigazione responsive.
- `02-dashboard-overview.md` — salute del workspace, priorità, attività e scorciatoie.
- `03-repositories-catalog.md` — vista mappa/tabella, ricerca, filtri e scansione del workspace.
- `04-favorites.md` — raccolta compatta dei repository preferiti ed empty state.
- `05-docker-control-center.md` — runtime Docker a livello workspace.
- `06-agent-sessions.md` — ricerca e ripresa delle conversazioni Codex, Claude Code e Gemini.
- `07-task-engineering.md` — pianificazione AI, review con gate e implementazione. **Sezione parcheggiata:** la UI è nascosta e la sezione non è raggiungibile; usa questo prompt solo se il redesign di Task engineering torna in scope.
- `08-automations.md` — editor visuale, nodi, input runtime, esecuzioni e storico.
- `09-repository-workspace-shell.md` — repository aperti, header, tab interne e contesto persistente.
- `10-repository-overview.md` — landing operativa del singolo repository.
- `11-repository-git-changes.md` — file staged/unstaged, diff, commit, stash e sync.
- `12-repository-branches.md` — ricerca, divergenza, checkout e creazione branch.
- `13-repository-terminal.md` — transcript persistente, suggerimenti, run/stop/clear.
- `14-repository-docker.md` — servizi Compose, porte, log e azioni di stack/servizio.
- `15-global-search-dialogs.md` — command palette, dialog, feedback e operazioni distruttive.

## Fonti applicative autorevoli

I prompt derivano dall'implementazione corrente sotto:

- `apps/web/src/components/dashboard/`
- `apps/web/src/components/project/`
- `apps/web/src/components/agents/`
- `apps/web/src/components/automation/`
- `apps/web/src/components/auth/`
- `apps/web/src/components/settings/`
- `apps/web/src/components/task/` (nascosto, conservato per il redesign)
- `apps/web/src/theme.ts`
- `apps/web/src/types/`

Se il codice cambia, aggiornare prima l'inventario funzionale nei prompt; il redesign non deve inventare capacità che l'app non possiede.
