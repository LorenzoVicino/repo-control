# Sezione 03 — Catalogo Repository

## Fonti da leggere

- `apps/web/src/components/dashboard/ProjectsDashboard.tsx`
- `apps/web/src/components/dashboard/WorkspaceMap.tsx`
- `apps/web/src/components/dashboard/ProjectTable.tsx`
- `apps/web/src/components/shared/StatusChips.tsx`
- `apps/web/src/components/shared/SyncChips.tsx`
- `apps/web/src/types/projects.ts`

## Prompt pronto da incollare

Ridisegna la sezione Repository come un catalogo operativo capace di gestire da 1 a 50 repository senza perdere stato, leggibilità o velocità di apertura.

### Funzioni da preservare

- Vista visuale/mappa e vista tabella.
- Ricerca per nome, path o branch.
- Stato working tree: clean, staged, modified, untracked.
- Sincronizzazione: ahead, behind, diverged, upstream.
- Ultimo commit con messaggio, data e autore.
- Presenza Docker Compose.
- Preferito e toggle del preferito.
- Apertura del repository nel workspace persistente.
- Empty state e scansione workspace.

### Problema da risolvere

La rappresentazione attuale usa molte chip e card simili. Con più repository diventa difficile distinguere identità, urgenza e segnali secondari. Progetta un modello di riga/card che risponda in ordine a:

1. quale repository è;
2. se richiede attenzione;
3. che tipo di attenzione;
4. quanto è recente il contesto;
5. quale azione compiere.

### Requisiti di design

- Definisci una vista “scan” visuale e una vista “audit” tabellare, entrambe basate sugli stessi token e indicatori.
- Raggruppamento opzionale per salute, cartella, preferiti o stato sync; non inventare tag server-side.
- Sorting evidente e modificabile: priorità, nome, ultimo commit, modifiche, behind.
- Stato selected/opened distinto da hover e favorite.
- Nomi/path/branch lunghi con strategia di truncation e accesso al valore completo.
- Una densità compact per power user e una comfortable, senza cambiare l'IA.
- Azione primaria “Apri” disponibile sull'intera riga/card; azioni secondarie non devono generare click accidentali.
- Non affidarti solo a verde/giallo/rosso: usa struttura, label e simboli.

### Stati obbligatori

- repository clean, dirty, ahead, behind, diverged;
- branch senza upstream;
- ultimo commit assente;
- Compose presente/assente;
- repository già aperto;
- lista vuota, ricerca senza risultati, scansione e errore parziale.

### Deliverable specifici

- Component anatomy per `RepositoryRow`, `RepositoryTile`, `StatusSignal` e `RepositoryCollectionToolbar`.
- Desktop con 20 repository realistici e non solo 4 esempi perfetti.
- Laptop con tabella orizzontalmente sostenibile senza nascondere lo stato essenziale.
- Mobile con lista single-column e progressive disclosure.
- Specifica di sorting, grouping, filtri e navigazione da tastiera.
- Confronto motivato tra vista visuale e tabella: quale domanda risponde ciascuna.
