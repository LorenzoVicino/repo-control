# Sezione 10 — Repository / Panoramica

## Fonti da leggere

- `apps/web/src/components/project/RepositoryOverviewPanel.tsx`
- `apps/web/src/components/project/ProjectDetailPanel.tsx`
- `apps/web/src/types/git.ts`
- `apps/web/src/types/docker.ts`

## Prompt pronto da incollare

Ridisegna Panoramica come la landing operativa del singolo repository. Deve sintetizzare working tree, sincronizzazione, Docker e attività recente senza duplicare integralmente le tab specialistiche.

### Funzioni da preservare

- Area “Richiede attenzione” con problemi actionable oppure conferma “Repository in ordine”.
- Working tree con staged/unstaged/untracked.
- Branch, upstream, ahead, behind e divergenza.
- Docker Compose con servizi running/totali o assenza.
- Ultimo commit.
- Attività Git recente paginabile con refs, autore, hash e data.
- Azioni rapide contestuali e sicure: apri VS Code, avvia/ferma stack quando disponibile.
- Loading, dati mancanti ed errori parziali.

### Obiettivo UX

Rispondere a tre domande nell'ordine:

1. Posso lavorare o aggiornare in sicurezza?
2. Cosa è cambiato dall'ultima volta?
3. Quale strumento devo aprire ora?

### Requisiti di design

- La sezione attenzione deve dominare solo quando esiste un problema; lo stato healthy non deve occupare lo stesso peso.
- Trasforma i quattro snapshot in una sintesi comparabile ma non in quattro card identiche.
- La recent activity deve essere facile da scansionare per messaggio, ref, autore e tempo.
- Le quick action devono dichiarare scope e precondizioni; non confondere navigazione verso una tab con esecuzione immediata.
- Prevedi collegamenti profondi verso Modifiche, Branch e Docker quando il problema appartiene a quelle tab.
- Usa contenuto reale con 0 e 20 modifiche, branch diverged, Compose unhealthy e commit lunghi.

### Stati obbligatori

- tutto healthy;
- dirty soltanto;
- behind/diverged;
- Docker parzialmente unhealthy;
- nessun commit;
- caricamento attività e “carica altri”;
- Git disponibile ma Docker in errore.

### Deliverable specifici

- Due layout: healthy e action-needed.
- Modello di attention item con severità, causa, impatto e next step.
- Handoff delle transizioni verso le tab specialistiche.
- Responsive che mantenga attenzione e stato prima della cronologia.
