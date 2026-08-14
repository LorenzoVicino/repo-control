# Sezione 01 — App shell e navigazione

## Fonti da leggere

- `apps/web/src/components/dashboard/DashboardSidebar.tsx`
- `apps/web/src/components/dashboard/DashboardAppBar.tsx`
- `apps/web/src/components/dashboard/ProjectsDashboard.tsx`
- `apps/web/src/components/dashboard/WorkspaceToolbarPicker.tsx`
- `apps/web/src/theme.ts`

## Prompt pronto da incollare

Progetta la nuova app shell di repo-control applicando la direzione visiva scelta nel master brief. La shell deve supportare sia il triage globale del workspace sia sessioni di lavoro profonde dentro più repository aperti.

### Funzioni da preservare

- Navigazione verso Dashboard, Agent sessions, Automazioni, Docker, Preferiti e Repository.
- Predisposizione per Task engineering, anche se la sua visibilità potrà essere capability-driven.
- Badge numerici per repository, preferiti e gruppi Docker.
- Docker nascosto quando il runtime non è disponibile.
- Sidebar desktop espansa/compressa e drawer mobile.
- Workspace locale attivo, cambio cartella con `Ctrl+O` ed errore del picker.
- Selezione palette/tema.
- App bar con titolo contestuale, repository attivo, ricerca `Ctrl+P`, refresh, versione e aggiornamento applicazione.
- Fascia dei repository aperti, progettata nella sezione 09, integrabile senza creare una terza navigazione competitiva.

### Problema da risolvere

La shell corrente è leggibile ma somiglia a un template admin: sidebar, app bar e contenuto hanno pesi molto simili. Il nuovo design deve rendere immediatamente percepibili tre livelli distinti:

1. **workspace globale**;
2. **repository aperto e contesto corrente**;
3. **strumento o sezione attiva**.

### Gerarchia e comportamento richiesti

- Proponi almeno due anatomie della shell prima di scegliere: sidebar tradizionale evoluta e rail/command-center alternativo.
- Rendi il workspace picker parte dell'identità contestuale, non un controllo relegato nel footer.
- Mantieni ricerca globale e cambio repository disponibili da ogni schermata.
- Definisci un segnale persistente per repository dirty o comando/run attivo anche quando l'utente cambia sezione.
- Evita che sidebar, app bar, tab dei repository e tab interne consumino troppo spazio verticale sul laptop.
- Progetta collapsed state, mobile drawer, overflow delle label, nomi lunghi e 50 repository.
- Indica quali elementi sono sticky, scrollano o scompaiono con il contesto.
- Progetta focus order, shortcut hints e stato `aria-current` leggibile anche senza colore.

### Stati obbligatori

- workspace caricato, vuoto, in scansione e non accessibile;
- Docker disponibile/non disponibile;
- update disponibile, aggiornamento in corso, errore e versione aggiornata;
- sidebar espansa, compressa e mobile;
- repository attivo/non attivo, dirty e con processo attivo;
- contenuto in navigazione o refresh.

### Deliverable specifici

- Anatomia desktop/laptop/mobile della shell.
- Specifica delle dimensioni min/max di rail, header e repository strip.
- State map della navigazione.
- Componenti `NavigationItem`, `WorkspaceIdentity`, `GlobalSearchTrigger`, `ContextHeader`, `RepositoryTab` e `GlobalStatusIndicator` con varianti.
- Regole per nascondere/mostrare sezioni capability-driven senza far “saltare” la navigazione.
- Prototipo del passaggio Dashboard → repository → Git → Agent sessions → ritorno al repository, dimostrando che il contesto non si perde.

Non progettare una sidebar decorativa. La shell deve ridurre realmente il costo di orientamento e di cambio contesto.
