# Sezione 06 — Agent sessions

## Fonti da leggere

- `apps/web/src/components/agents/AgentSessionsPage.tsx`
- `apps/web/src/api/agentSessions.ts`
- `apps/web/src/types/agentSessions.ts`

## Prompt pronto da incollare

Ridisegna Agent sessions, la sezione che indicizza conversazioni locali di Codex, Claude Code e Gemini CLI associate ai repository del workspace. Deve sembrare un **local context browser**, non una chat app generica e non una inbox cloud.

### Funzioni da preservare

- Rilevamento e stato per provider: disponibile, non installato, non configurato o errore.
- Conteggi delle sessioni.
- Filtro per provider.
- Ricerca debounced nei titoli e nel contenuto delle conversazioni.
- Cancella ricerca e indicatore di ricerca in corso.
- Risultati ordinati dal più recente.
- Provider, repository, branch, timestamp, titolo, preview e match nel titolo/contenuto.
- Contesto prima/dopo del match quando disponibile.
- Ripresa della sessione nel terminale nativo corretto.
- Feedback se il terminale non può essere aperto e comando manuale di fallback.
- Empty state per nessuna sessione, nessun risultato o provider non disponibile.

### Obiettivo UX

L'utente deve poter ritrovare una conversazione attraverso un frammento ricordato, verificarne repository/provider/recenza e riprenderla senza il rischio di aprire il contesto sbagliato.

### Requisiti di design

- Separa nettamente **availability dei provider**, **query attiva** e **risultati**.
- Il repository deve avere almeno la stessa priorità visiva del provider.
- Progetta un master-detail desktop: lista scansionabile e preview/dettaglio persistente, oppure motiva un'alternativa migliore.
- Evidenzia il match senza distruggere la leggibilità del messaggio.
- Mostra sempre lo scope del comando Resume prima dell'azione.
- Usa il colore dei provider come accento secondario, non come struttura primaria.
- Prevedi titolo mancante, preview lunga, match multipli, 0/1/200 risultati e sessioni senza branch.
- Sul mobile privilegia ricerca, lista e resume; il dettaglio può diventare una route/pannello successivo.

### Stati obbligatori

- provider misti disponibili/non disponibili;
- prima della ricerca e durante la ricerca;
- risultato in titolo e risultato nel contenuto;
- nessun risultato;
- resume in corso, riuscito, fallito e fallback manuale;
- errori parziali di un provider con risultati degli altri ancora utilizzabili.

### Deliverable specifici

- Anatomia `ProviderFilter`, `SessionResult`, `MatchContext`, `SessionInspector` e `ResumeAction`.
- Desktop con risultati realistici di tre provider.
- Mobile con flusso ricerca → dettaglio → resume.
- Specifica della tastiera: shortcut ricerca, frecce nella lista, Enter per aprire, shortcut esplicita per Resume.
- Microcopy italiana per availability, privacy locale e fallback terminale.
