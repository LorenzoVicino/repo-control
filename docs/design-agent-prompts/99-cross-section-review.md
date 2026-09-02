# Prompt finale — Audit cross-section del redesign

## Prompt pronto da incollare

Hai completato il redesign delle sezioni di repo-control. Ora esegui un audit severo dell'intero sistema prima dell'handoff. Non valutare le schermate come immagini isolate: ricostruisci i journey e verifica che shell, componenti, stati e linguaggio siano coerenti.

### Journey da simulare

1. Seleziona un workspace → individua un repository dirty → aprilo → ispeziona diff → stage → commit → push.
2. Apri due repository → avvia un comando nel Terminale del primo → passa al secondo → torna al primo → stop/leggi output.
3. Dashboard → Docker globale → repository interessato → Docker Compose → servizio unhealthy → log → restart.
4. Agent sessions → ricerca nel contenuto → verifica repository/branch → resume → fallback manuale in caso di terminale non disponibile.
5. Automazioni → nuovo workflow → aggiungi/configura nodi → correggi validazione → dry-run → run → close → storico → cancel.
6. Tab Profilo → Impostazioni → palette e dimensione del testo → ritorno a una schermata densa, verificando che il livello grande non tronchi label né rompa la densità.
7. Mobile: Dashboard → Repository → Panoramica → stato Git → ritorno alla ricerca globale.

### Audit di coerenza

Per ogni punto assegna `pass`, `needs revision` o `missing`, con prova visiva:

- Il contesto workspace/repository/branch è sempre chiaro.
- La stessa semantica di stato produce lo stesso pattern in Dashboard, Repository, Automazioni e Docker.
- Primary, secondary, risky e destructive action hanno una gerarchia consistente.
- Loading, empty, partial error, full error e stale data sono progettati ovunque.
- Le superfici non ricadono nel card soup.
- I nomi lunghi e l'output reale non rompono il layout.
- La densità laptop è credibile.
- Mobile conserva le decisioni essenziali senza fingere di supportare ogni authoring desktop.
- Focus, shortcut, hover, active, selected e disabled sono distinguibili.
- Reduced motion, contrasto e zoom 200% sono coperti.
- Terminale, diff, log e codice condividono una grammatica mono coerente.
- Docker globale e Docker repository sono distinguibili ma parenti.
- Le preferenze di interfaccia dicono la stessa cosa nel menu profilo e nella sezione Impostazioni.
- Nessun controllo promette feature backend inesistenti.

### Audit dei token

Verifica e consolida:

- palette neutral e semantic;
- typography e mono roles;
- spacing scale;
- density modes;
- radius e border hierarchy;
- 3–4 surface levels;
- elevation/lighting;
- focus ring;
- status iconography;
- motion duration/easing;
- responsive breakpoints.

Elimina token duplicati o eccezioni create per una singola schermata senza motivazione.

### Handoff finale richiesto

Consegna:

1. sitemap e anatomy definitiva;
2. design system page con tutti i componenti condivisi;
3. state matrix cross-section;
4. responsive matrix;
5. accessibilità e keyboard contract;
6. lista ordinata delle revisioni ancora necessarie;
7. mapping schermata → componenti React/MUI esistenti;
8. piano di implementazione incrementale che eviti un big-bang rewrite;
9. definition of done verificabile per il redesign.

Non dichiarare il sistema coerente solo perché colori e font coincidono. La coerenza deve essere dimostrata nei comportamenti, nella gerarchia, nella semantica degli stati e nei journey completi.
