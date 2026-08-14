# Sezione 04 — Preferiti

## Fonti da leggere

- `apps/web/src/components/dashboard/ProjectsDashboard.tsx`
- `apps/web/src/components/dashboard/WorkspaceMap.tsx`
- `apps/web/src/components/dashboard/dashboardSnapshot.ts`

## Prompt pronto da incollare

Progetta la sezione Preferiti come un **launchpad personale** per i repository usati più spesso. Non deve sembrare la sezione Repository filtrata con un titolo diverso.

### Funzioni da preservare

- Elenco dei repository preferiti.
- Stato Git e sync essenziale.
- Ultimo commit.
- Apertura rapida del repository.
- Rimozione dai preferiti senza aprire il repository.
- Empty state quando non esistono preferiti.

### Obiettivo UX

In questa vista l'utente conosce già i repository. Riduci il rumore anagrafico e privilegia continuità del lavoro: ultimo contesto, stato corrente, attenzione e accesso rapido.

### Requisiti di design

- Esplora una disposizione più compatta o “pinned workspaces” rispetto al catalogo generale.
- Rendi evidente se un repository preferito è già aperto, dirty o ha attività recente.
- Prevedi una quick action per aprire il repository e una per rimuoverlo, con target non ambiguo.
- L'empty state deve spiegare come aggiungere un preferito e offrire un passaggio diretto a Repository.
- Valuta una piccola area “Riprendi” basata solo sui dati già disponibili; non inventare cronologia di file o editor.

### Stati obbligatori

- 0, 1, 3 e 12 preferiti;
- preferito clean, dirty, behind e già aperto;
- nome/path lungo;
- dati in refresh o parzialmente mancanti.

### Deliverable specifici

- Layout desktop, laptop e mobile.
- Differenze esplicite rispetto alla sezione Repository.
- Componenti condivisi riutilizzati e componenti specifici motivati.
- Empty state completo e non puramente decorativo.
