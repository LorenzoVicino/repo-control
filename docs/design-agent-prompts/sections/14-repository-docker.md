# Sezione 14 — Repository / Docker Compose

## Fonti da leggere

- `apps/web/src/components/project/DockerDetailPanel.tsx`
- `apps/web/src/api/docker.ts`
- `apps/web/src/types/docker.ts`

## Prompt pronto da incollare

Ridisegna la tab Docker del repository come workspace Compose operativo. Deve distinguersi dal Docker Control Center globale: qui lo scope è un solo progetto e l'utente deve poter gestire stack, servizi, porte e log in profondità.

### Funzioni da preservare

- Nome progetto Compose, timestamp e running/total.
- Avvia stack, ferma stack e rebuild.
- Servizi configurati anche se il container non è stato ancora creato.
- Service/container name, state, health, image e published ports.
- Porta web apribile quando ha un URL valido.
- Selezione servizio.
- Restart del singolo servizio.
- Log del servizio selezionato, ultime 200 righe e refresh.
- Loading, Compose non disponibile, errore e lista vuota.

### Obiettivo UX

Consentire di capire la salute dello stack, aprire il servizio giusto e investigarne i log con pochissimo context switching, mantenendo chiaro se un'azione riguarda tutto lo stack o un singolo servizio.

### Requisiti di design

- Progetta master-detail: service list/health matrix e log inspector, con proporzioni adattabili.
- Le azioni stack e service devono avere gerarchia e scope visivamente diversi.
- Health, state e container-not-created non devono collassare in un'unica chip.
- Le porte devono mostrare mapping `host → target/protocol`; rendi cliccabili soltanto quelle navigabili.
- Il log viewer deve supportare testo lungo, errori, ricerca futura senza prometterla come funzione corrente e copia agevole.
- Mostra quale servizio alimenta i log e l'ultimo refresh.
- Prevedi 1, 6 e 30 servizi, immagini/path lunghi e porte multiple.
- Stack Stop/Rebuild richiedono conferma proporzionata al rischio e feedback progressivo.

### Stati obbligatori

- tutto running/healthy;
- mix running/stopped/unhealthy;
- servizio configurato ma non creato;
- stack action running/failure;
- service restart running/failure;
- log loading/empty/error/long;
- Docker/Compose non disponibile.

### Deliverable specifici

- Desktop e laptop con service list + logs.
- Mobile con passaggio lista → service detail → logs.
- Anatomia `ComposeHeader`, `ServiceRow`, `HealthSignal`, `PortMapping`, `StackAction`, `ServiceAction` e `LogViewer`.
- Prototipo selezione servizio, apertura porta, refresh log e restart.
