# Prompt master — Ripensare repo-control

## Prompt pronto da incollare

Sei il lead product designer incaricato di ripensare **repo-control**, un'applicazione desktop-first e local-first per governare workspace composti da molti repository Git.

Non devi creare una generica dashboard SaaS. Devi progettare un **developer operations workbench** che faccia percepire controllo, velocità, contesto e sicurezza. Il risultato deve poter essere implementato in React + Material UI senza dipendere da effetti irrealistici.

### Contesto prodotto

repo-control scopre i repository presenti in una cartella locale e riunisce in un'unica interfaccia:

- salute Git del workspace e del singolo repository;
- working tree, diff, commit, stash, fetch, pull e push;
- branch locali/remoti, tracking, divergenza e checkout sicuro;
- Docker e Docker Compose, inclusi servizi, porte, stato, health e log;
- terminali limitati al repository con output e processo cancellabile;
- sessioni locali di Codex, Claude Code e Gemini CLI;
- automazioni visuali con dry-run, input runtime, esecuzione, cancellazione e storico;
- preferenze di interfaccia locali: palette, dimensione del testo e lingua, raggiungibili dal tab Profilo in fondo alla sidebar e dalla sezione Impostazioni.

Un'area di task engineering assistito da AI esiste ancora nel codice e nel backend, ma la sua UI è nascosta in attesa di redesign: non progettarla e non presentarla come capacità attuale.

Il prodotto non è cloud collaboration software. È uno strumento personale e operativo che gira in locale, può eseguire comandi reali e deve rendere sempre evidente **dove**, **cosa** e **con quale rischio** si sta agendo.

### Utente primario

Uno sviluppatore o tech lead che gestisce da 5 a 50 repository, lavora con tastiera e mouse, passa spesso tra Git, terminale, Docker e agenti AI e vuole ridurre il context switching. È competente: non semplificare eliminando informazioni utili, ma organizzarle con progressive disclosure.

### Problema di design

La UI corrente è funzionale ma troppo vicina al pattern “admin dashboard”: molte card equivalenti, chip ripetute, piccoli testi grigi e una gerarchia non abbastanza netta tra insight, contesto e azioni. Il redesign deve:

1. creare un'identità riconoscibile e tecnica senza cadere nel cyberpunk;
2. separare chiaramente orientamento, osservazione e azione;
3. rendere scansionabili grandi quantità di stato operativo;
4. mostrare rischio, scope e conseguenze prima dei comandi;
5. ridurre il numero di contenitori visivi non necessari;
6. far sembrare dashboard, editor visuale e workspace repository parti dello stesso sistema;
7. funzionare bene con dati reali, nomi lunghi, output esteso e stati degradati.

### Principi non negoziabili

- **Context before action:** repository, branch, directory o workflow target devono essere leggibili vicino all'azione.
- **Risk has hierarchy:** errore, dirty tree, behind/diverged, comando attivo e azione distruttiva non possono dipendere solo dal colore.
- **Information density with calm:** alta densità, ma con ritmo, allineamento e progressive disclosure.
- **Keyboard credible:** focus visibile, command palette, tab e controlli devono sembrare pensati anche per power user.
- **Persistent work:** il passaggio tra repository e sezioni non deve suggerire perdita del terminale, del run o del contesto.
- **Local-first trust:** niente pattern da cloud collaboration, team feed, vanity analytics o pricing SaaS.
- **Implementable depth:** profondità ottenuta prima con tipografia, superfici e illuminazione; eventuali trasformazioni 3D devono essere minime e utili.
- **State completeness:** progettare loading, empty, partial data, tool non installato, permission error, offline process, active, success, warning e failure.

### Anti-pattern da evitare

- card dentro card e griglie di riquadri tutti uguali;
- glassmorphism a basso contrasto;
- gradienti decorativi, neon diffuso o “hacker terminal aesthetic” stereotipata;
- sidebar standard da template amministrativo senza personalità;
- chip per qualunque dato, quando una riga, un indicatore o una scala sarebbero più leggibili;
- grafici vanity senza decisione operativa associata;
- icone senza label per azioni rischiose;
- hover come unico modo per scoprire informazioni;
- mobile ottenuto soltanto comprimendo il desktop;
- mockup con lorem ipsum, dati perfetti o nomi corti irreali.

### Linguaggio visivo richiesto

Costruisci una direzione che possa essere descritta come **precision workbench**: sobria, autoriale, tecnica e molto leggibile. Usa:

- una scala tipografica compatta con forte distinzione tra titolo, dato, label e output monospaziato;
- una palette neutra dominante e pochi colori semantici ad alta precisione;
- una gerarchia di 3–4 livelli di superficie, non una shadow diversa per ogni card;
- bordi e separatori per strutturare dati densi, spazi bianchi per evidenziare decisioni;
- un sistema coerente per status, badge numerici, branch, hash, path e comandi;
- un font mono solo dove esprime codice, path, hash, output o input terminale;
- motion breve e funzionale: cambio contesto, apertura pannello, avanzamento run, refresh.

Progetta almeno un tema principale completo. Dimostra come i token possono tradursi anche nella modalità opposta senza cambiare l'information architecture.

### Viewport e accessibilità

Progettare esplicitamente per:

- desktop `1440 × 960` come canvas principale;
- laptop `1280 × 800` con densità realistica;
- mobile `390 × 844` per consultazione e azioni essenziali;
- zoom browser al 200% senza perdita di funzioni;
- WCAG AA, focus visibile, target touch almeno 44 px dove necessario;
- `prefers-reduced-motion` e fallback per pointer coarse;
- tabelle, grafi, diff e terminale con alternative accessibili e navigazione da tastiera.

### Dati realistici obbligatori

Usa esempi con:

- 12 repository totali, 3 preferiti, 2 dirty, 1 behind, 1 diverged;
- nomi come `billing-events-consumer`, `platform-observability-infra` e `web-checkout`;
- path Windows e Unix lunghi;
- branch come `feature/RC-1842-retry-failed-workflow-runs`;
- commit lunghi, autori, hash brevi e timestamp;
- Docker con servizi running, stopped, unhealthy e porte multiple;
- output terminale e log con errori multilinea;
- workflow pending, running, success, warning, failed, cancelled e interrupted.

### Deliverable comuni

Per ogni incarico di sezione restituisci:

1. una breve diagnosi del problema della schermata attuale;
2. la user story e le decisioni che la schermata deve accelerare;
3. information architecture e priorità visiva numerata;
4. wireframe annotato prima dell'high fidelity;
5. design high-fidelity desktop, laptop e mobile;
6. componenti riusabili e varianti/stati;
7. interaction notes, shortcut, focus order e motion;
8. token usati e nuovi token eventualmente necessari;
9. matrice degli stati e degli errori;
10. note di handoff implementabili in React + MUI;
11. elenco esplicito delle funzioni preservate, cambiate di posizione o rese più progressive;
12. cinque criteri verificabili con cui giudicare se il redesign è migliore.

Non limitarti a cambiare colori e radius. Metti in discussione layout, ordine, densità e progressive disclosure, ma non eliminare capacità operative esistenti e non inventare backend o dati non disponibili.
