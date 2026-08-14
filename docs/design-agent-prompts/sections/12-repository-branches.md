# Sezione 12 — Repository / Branch

## Fonti da leggere

- `apps/web/src/components/project/BranchesPanel.tsx`
- `apps/web/src/types/git.ts`
- `apps/web/src/api/projects.ts`

## Prompt pronto da incollare

Ridisegna la tab Branch come strumento per comprendere topologia e divergenza, cercare velocemente e fare checkout o creare un branch in sicurezza.

### Funzioni da preservare

- Branch corrente, upstream, default branch, ahead e behind.
- Indicazione checkout bloccato quando il repository è dirty.
- Fetch e Pull `ff-only`.
- Ricerca branch locali e remoti.
- Creazione di un nuovo branch.
- Sezioni/locali e remoti con conteggi.
- Latest commit per branch: messaggio, hash, autore e data.
- Label current, remote, upstream, ahead, behind e merged.
- Checkout branch locale o remoto con creazione tracking quando necessario.
- Loading, nessun risultato ed errori operativi.

### Obiettivo UX

Ridurre gli errori di checkout e far capire perché un branch è interessante prima di aprirlo: posizione, recenza, tracking, merge e divergenza.

### Requisiti di design

- Il branch corrente deve avere un contesto sintetico dominante ma non occupare mezza pagina.
- Separa ricerca/creazione da fetch/pull: sono intenti diversi.
- La lista deve reggere centinaia di branch; progetta densità, virtualizzazione concettuale e sticky section headers.
- Local e remote devono essere distinguibili senza duplicare righe inutilmente.
- Dirty checkout blocked deve spiegare causa e next step, non soltanto disabilitare il pulsante.
- Mostra branch lunghi e commit lunghi senza perdere azione e badge.
- Valuta una visualizzazione di divergenza compatta, non un Git graph completo se i dati non lo supportano.

### Stati obbligatori

- branch current/default/tracking;
- local merged e non merged;
- remote senza local tracking;
- ahead, behind e diverged;
- dirty repository;
- fetch/pull/checkout/create running e failure;
- ricerca senza risultati.

### Deliverable specifici

- Layout per 8 e 300 branch.
- Anatomia `CurrentBranchSummary`, `BranchRow`, `DivergenceSignal`, `CheckoutAction` e `CreateBranchForm`.
- Flusso checkout remote → tracking local.
- Specifica keyboard per ricerca e selezione della lista.
