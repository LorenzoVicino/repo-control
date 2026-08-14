# Sezione 09 — Shell del workspace Repository

## Fonti da leggere

- `apps/web/src/components/project/ProjectWorkspaceTabs.tsx`
- `apps/web/src/components/project/ProjectDetailPanel.tsx`
- `apps/web/src/components/project/projectWorkspaceIds.ts`
- `apps/web/src/types/projects.ts`

## Prompt pronto da incollare

Progetta la shell del workspace usato quando uno o più repository sono aperti. Questa superficie deve comunicare persistenza e contesto come un IDE, restando coerente con la shell globale di repo-control.

### Funzioni da preservare

- Apertura simultanea di più repository.
- Repository tab attiva, chiusura e fallback alla tab vicina.
- Navigazione tab da tastiera con frecce, Home ed End.
- Nome repository, branch e dirty indicator nella tab.
- Contenuto montato/persistente per repository aperti.
- Header del repository con nome, path, branch, clean/dirty, behind, favorite, refresh e stato loading.
- Tab interne: Panoramica, Modifiche, Branch, Terminale e Docker capability-driven.
- Badge per numero modifiche, behind e servizi Docker running/totali.
- Terminale mantenuto montato durante la navigazione interna.

### Problema da risolvere

Sidebar globale, app bar, repository tabs, header repository e tab interne possono creare cinque fasce orizzontali prima del contenuto. Riduci il chrome senza perdere orientamento, persistenza o accessibilità.

### Requisiti di design

- Proponi due modelli: repository tabs esplicite e switcher compatto con recent/open state.
- Mantieni visibile lo scope completo `workspace → repository → branch → strumento`.
- Dirty, behind e processo attivo devono sopravvivere anche nella forma compatta della tab.
- Specifica overflow con 2, 8 e 20 repository aperti.
- Evita doppioni tra app bar e header repository; assegna a ogni fascia una responsabilità.
- Docker tab appare solo con Compose; la futura CI/CD dovrà apparire solo se rilevata, senza placeholder.
- Progetta un indicatore discreto per terminal command o workflow collegato ancora attivo.
- Definisci quale scroll appartiene alla pagina e quale ai pannelli interni.

### Stati obbligatori

- un repository aperto;
- più repository con active, dirty e command-running diversi;
- repository chiuso dalla prima, ultima e tab attiva;
- tab Docker presente/assente;
- path e branch molto lunghi;
- refresh e fetch parzialmente falliti.

### Deliverable specifici

- Anatomia completa della shell repository a 1440 e 1280 px.
- Variante mobile con switcher credibile.
- Specifica `RepositoryTab`, `RepositoryContextHeader`, `ToolTab` e status persistence.
- Focus order e comportamento keyboard.
- Diagramma delle responsabilità: cosa appartiene alla shell globale, al repository e alla tab attiva.
