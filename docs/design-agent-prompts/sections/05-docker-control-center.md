# Sezione 05 — Docker Control Center del workspace

## Fonti da leggere

- `apps/web/src/components/dashboard/ControlCenter.tsx`
- `apps/web/src/api/docker.ts`
- `apps/web/src/types/docker.ts`

## Prompt pronto da incollare

Ridisegna il Docker Control Center globale di repo-control. Questa schermata aggrega gruppi runtime appartenenti a repository diversi e deve consentire un controllo veloce senza confondere container, servizi Compose e repository sorgente.

### Funzioni da preservare

- Stato del runtime Docker e numero di gruppi/container.
- Refresh manuale e aggiornamento in corso.
- Gruppi per progetto Compose o container.
- Container/service name, image, stato, health, porte e repository/path quando disponibili.
- Stop del gruppo Compose o del container con stato di esecuzione e errore.
- Docker non disponibile, daemon fermo, permission error, nessun container.
- Progressive disclosure quando esistono molti progetti e servizi.

### Obiettivo UX

Rispondere subito a:

- Docker sta funzionando?
- Quale gruppo è problematico?
- Quali servizi stanno esponendo porte?
- Qual è lo scope dell'azione Stop?

### Requisiti di design

- Progetta una fascia runtime globale separata dall'elenco dei gruppi.
- Usa lo stato health come segnale primario; “running” non equivale automaticamente a healthy.
- Mostra il confine di scope tra workspace, gruppo e singolo servizio.
- Prima dello Stop rendi evidente quante risorse saranno coinvolte.
- Evita una card indipendente per ogni container se il risultato diventa rumoroso; esplora righe, gruppi collassabili o master-detail.
- Le porte web cliccabili devono essere distinguibili dalle porte non navigabili.
- Prevedi 2, 8 e 30 gruppi runtime.

### Stati obbligatori

- runtime healthy, unavailable e permission denied;
- gruppo tutto running, parzialmente stopped, unhealthy e in stop;
- service senza container creato;
- immagine o porta assente;
- errore di un singolo gruppo senza oscurare gli altri.

### Deliverable specifici

- Information architecture globale → gruppo → servizio.
- Componenti `RuntimeStatus`, `RuntimeGroup`, `ServiceState`, `PortLink` e `ScopedStopAction`.
- Prototipo di refresh, espansione gruppo e stop con feedback.
- Layout compact per laptop e lista mobile consultabile.
