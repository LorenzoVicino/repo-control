export const en = {
  common: {
    repository: "Repository",
    workspace: "Workspace"
  },
  navigation: {
    ariaLabel: "Dashboard navigation",
    mobileAriaLabel: "Mobile dashboard navigation",
    sectionsAriaLabel: "Dashboard sections",
    workspaceGroup: "Workspace",
    openProjects: "Open",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    sections: {
      overview: "Dashboard",
      repositories: "Repositories",
      favorites: "Favorites",
      docker: "Docker",
      agents: "Agent sessions",
      automations: "Automations",
      tasks: "Task engineering",
      settings: "Settings"
    },
    selectWorkspace: "Select workspace",
    changeWorkspace: "Change workspace folder, shortcut Ctrl+O",
    openingFolderPicker: "Opening folder picker…",
    scanningWorkspace: "Scanning workspace…",
    appearance: "Appearance",
    appearanceActive: "Appearance: {{palette}}",
    selectPalette: "Select color palette. Active palette: {{palette}}",
    paletteMenu: "Color palettes",
    appearanceMenuTitle: "Interface appearance",
    appearanceMenuDescription: "Choose a complete palette for surfaces and accents."
  },
  appearance: {
    palettes: {
      white: { label: "White", description: "Neutral light theme" },
      black: { label: "Black", description: "Neutral dark theme" },
      red: { label: "Red", description: "Warm dark theme" },
      blue: { label: "Blue", description: "Cool dark theme" },
      green: { label: "Green", description: "Natural dark theme" }
    }
  },
  appBar: {
    openNavigation: "Open navigation",
    searchTooltip: "Search repositories (Ctrl+P)",
    searchPlaceholder: "Search repositories",
    searchAriaLabel: "Open repository search, shortcut Ctrl+P",
    scanning: "scanning…",
    workspaceUpdated: "workspace up to date",
    update: "Update",
    viewMode: "View mode",
    repositoryGrid: "Repository grid",
    tableView: "Table view",
    refreshRepositories: "Refresh repositories",
    updateStatus: {
      updating: "Update in progress",
      checking: "Checking for new releases",
      available: "New release available: v{{version}}",
      unavailable: "Release check unavailable: {{error}}",
      failed: "Release check failed: {{error}}",
      current: "No new release available",
      updateTo: "Update repo-control to version {{version}}",
      updateApp: "Update repo-control"
    }
  },
  repositories: {
    title: "Repositories",
    searchResults: "{{count}} results for “{{search}}”",
    organizedByFolder: "Organized by workspace folder",
    sortAriaLabel: "Sort repositories",
    sort: {
      attention: "Needs attention first",
      recent: "Most recent commit",
      changes: "Most local changes",
      name: "Name A–Z"
    },
    groupAriaLabel: "Group repositories",
    group: {
      folder: "By folder",
      status: "By operational status"
    },
    densityAriaLabel: "Repository density",
    densityCompactAriaLabel: "Compact density",
    densityComfortableAriaLabel: "Comfortable density",
    densityCompact: "Compact",
    densityComfortable: "Comfortable",
    projectAriaLabel: "Repository {{name}}",
    loading: "Loading repositories"
  },
  dashboard: {
    home: {
      triage: "Workspace triage",
      readyForScan: "Workspace ready to scan",
      attentionSummary: "{{attention}} of {{total}} repositories need attention",
      description: "Local operational status: changes, synchronization, runtime and recent activity in one pass.",
      repositories: "repositories",
      ready: "ready",
      changes: "changes",
      workspaceLedger: "Workspace ledger",
      repositoryCount: "{{count}} repositories",
      explore: "Explore",
      columns: {
        repository: "Repository",
        branch: "Branch",
        tree: "Tree",
        sync: "Sync",
        runtime: "Runtime",
        lastCommit: "Last commit"
      },
      selectFolder: "Select a workspace folder to populate the ledger.",
      operationalStatus: "Operational status",
      readyPercentage: "{{percentage}}% ready",
      actionRequired: "Action required",
      workspaceStable: "Workspace stable",
      dirty: "dirty",
      behind: "behind",
      ahead: "ahead",
      runtime: "Runtime",
      dockerOnline: "Docker online",
      unavailable: "unavailable",
      containersRunning: "{{count}} containers running",
      runtimeNotDetected: "Runtime not detected",
      groups: "groups",
      containers: "containers",
      openRuntime: "Open runtime",
      recentCommits: "Recent commits",
      activityCount: "{{count}} activities",
      noCommit: "No commit",
      noCommitsDetected: "No commits detected.",
      perspective: "Perspective",
      anotherQuote: "Show another quote",
      clean: "clean",
      modifiedShort: "{{count}} mod.",
      runtimeStatus: {
        offline: "offline",
        running: "running",
        stopped: "stopped"
      }
    },
    pulse: {
      snapshot: "Operational snapshot",
      title: "Workspace signals",
      ready: "ready",
      distribution: "Operational distribution: {{description}}",
      emptySignals: "Signals will appear after the first workspace scan.",
      changeConcentration: "Change concentration",
      changeDescription: "Where the local workload is, ordered by volume",
      changeLegend: "Change type legend",
      staged: "Staged",
      modified: "Modified",
      untracked: "New",
      treesAligned: "Working trees aligned",
      noLocalChanges: "No local changes to distribute.",
      openProject: "Open {{name}}, {{count}} changed files",
      branchNotDetected: "branch not detected",
      changesAria: "{{staged}} staged, {{modified}} modified, {{untracked}} new",
      blocked: "Blocked",
      action: "Needs action",
      ahead: "Ahead",
      readySignal: "Ready"
    }
  },
  loading: {
    tasks: "Loading task engineering",
    agents: "Detecting agent sessions",
    automations: "Loading automations"
  },
  errors: {
    pickFolder: "Unable to pick folder",
    scanWorkspace: "Unable to scan workspace. Choose a narrower folder and try again.",
    stopDocker: "Unable to stop Docker containers"
  },
  workspaceState: {
    unavailableTitle: "Workspace data is unavailable",
    unavailableDescription: "repo-control could not read this workspace, so no repository health assessment is being shown.",
    staleTitle: "Workspace refresh failed",
    staleDescription: "Showing the last successful snapshot from {{lastUpdated}}.",
    retry: "Retry",
    retrying: "Retrying…",
    changeWorkspace: "Change workspace",
    unknownError: "The workspace request failed for an unknown reason.",
    unknownUpdateTime: "an unknown time"
  },
  operations: {
    title: "Operation history",
    history: "Operations",
    historyAria: "Recent project operations",
    openHistoryAria: "Open operation history, {{count}} operations",
    details: "Details",
    dismiss: "Dismiss operation notification",
    completed: "{{source}} completed",
    failed: "{{source}} failed",
    success: "Success",
    failure: "Failed",
    scope: "Scope",
    command: "Command",
    exitCode: "Exit code",
    duration: "Duration",
    output: "Output",
    noOutput: "The operation returned no output.",
    clear: "Clear history",
    copy: "Copy details",
    copied: "Copied",
    copyFailed: "Copy failed",
    close: "Close",
    sources: {
      overview: "Repository action",
      changes: "Git changes",
      branches: "Git branches",
      docker: "Docker action"
    }
  },
  settings: {
    eyebrow: "Workspace preferences",
    title: "Settings",
    description: "Shape repo-control around the way you work. Preferences are saved locally on this device.",
    general: "General",
    generalDescription: "Language and regional preferences",
    languageAndRegion: "Language & region",
    languageTitle: "Interface language",
    languageDescription: "Choose the language used for navigation, controls and system messages.",
    languageFieldLabel: "Choose interface language",
    english: "English",
    englishNative: "English",
    italian: "Italian",
    italianNative: "Italiano",
    active: "Active",
    savedAutomatically: "Changes are saved automatically",
    immediateNote: "The interface updates immediately. Your choice will be remembered the next time you open repo-control.",
    localPreference: "Stored on this device",
    translationEngine: "Powered by i18next"
  }
} as const;

type TranslationSchema<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationSchema<T[Key]>;
};

export const it: TranslationSchema<typeof en> = {
  common: {
    repository: "Repository",
    workspace: "Workspace"
  },
  navigation: {
    ariaLabel: "Navigazione dashboard",
    mobileAriaLabel: "Navigazione dashboard mobile",
    sectionsAriaLabel: "Sezioni dashboard",
    workspaceGroup: "Spazio di lavoro",
    openProjects: "Aperti",
    expandSidebar: "Espandi sidebar",
    collapseSidebar: "Comprimi sidebar",
    sections: {
      overview: "Dashboard",
      repositories: "Repository",
      favorites: "Preferiti",
      docker: "Docker",
      agents: "Sessioni agent",
      automations: "Automazioni",
      tasks: "Task engineering",
      settings: "Impostazioni"
    },
    selectWorkspace: "Seleziona workspace",
    changeWorkspace: "Cambia cartella workspace, scorciatoia Ctrl+O",
    openingFolderPicker: "Apertura selettore cartelle…",
    scanningWorkspace: "Scansione workspace…",
    appearance: "Aspetto",
    appearanceActive: "Aspetto: {{palette}}",
    selectPalette: "Seleziona palette colori. Palette attiva: {{palette}}",
    paletteMenu: "Palette colori",
    appearanceMenuTitle: "Aspetto interfaccia",
    appearanceMenuDescription: "Scegli una palette completa per superfici e accenti."
  },
  appearance: {
    palettes: {
      white: { label: "Bianco", description: "Tema chiaro neutro" },
      black: { label: "Nero", description: "Tema scuro neutro" },
      red: { label: "Rosso", description: "Tema scuro caldo" },
      blue: { label: "Blu", description: "Tema scuro freddo" },
      green: { label: "Verde", description: "Tema scuro naturale" }
    }
  },
  appBar: {
    openNavigation: "Apri navigazione",
    searchTooltip: "Cerca repository (Ctrl+P)",
    searchPlaceholder: "Cerca repository",
    searchAriaLabel: "Apri ricerca repository, scorciatoia Ctrl+P",
    scanning: "scansione…",
    workspaceUpdated: "workspace aggiornato",
    update: "Aggiorna",
    viewMode: "Modalità vista",
    repositoryGrid: "Griglia repository",
    tableView: "Vista tabella",
    refreshRepositories: "Aggiorna repository",
    updateStatus: {
      updating: "Aggiornamento in corso",
      checking: "Controllo nuove release in corso",
      available: "Nuova release disponibile: v{{version}}",
      unavailable: "Controllo release non disponibile: {{error}}",
      failed: "Controllo release non riuscito: {{error}}",
      current: "Nessuna nuova release disponibile",
      updateTo: "Aggiorna repo-control alla versione {{version}}",
      updateApp: "Aggiorna repo-control"
    }
  },
  repositories: {
    title: "Repository",
    searchResults: "{{count}} risultati per “{{search}}”",
    organizedByFolder: "Organizzati per cartella di lavoro",
    sortAriaLabel: "Ordina repository",
    sort: {
      attention: "Prima quelli da controllare",
      recent: "Commit più recente",
      changes: "Più modifiche locali",
      name: "Nome A–Z"
    },
    groupAriaLabel: "Raggruppa repository",
    group: {
      folder: "Per cartella",
      status: "Per stato operativo"
    },
    densityAriaLabel: "Densità repository",
    densityCompactAriaLabel: "Densità compatta",
    densityComfortableAriaLabel: "Densità comoda",
    densityCompact: "Compatta",
    densityComfortable: "Comoda",
    projectAriaLabel: "Repository {{name}}",
    loading: "Caricamento repository"
  },
  dashboard: {
    home: {
      triage: "Triage workspace",
      readyForScan: "Workspace pronto per la scansione",
      attentionSummary: "{{attention}} di {{total}} repository richiedono attenzione",
      description: "Stato operativo locale: modifiche, sincronizzazione, runtime e attività recente in un solo passaggio.",
      repositories: "repository",
      ready: "pronti",
      changes: "modifiche",
      workspaceLedger: "Registro workspace",
      repositoryCount: "{{count}} repository",
      explore: "Esplora",
      columns: {
        repository: "Repository",
        branch: "Branch",
        tree: "Albero",
        sync: "Sync",
        runtime: "Runtime",
        lastCommit: "Ultimo commit"
      },
      selectFolder: "Seleziona una cartella workspace per popolare il registro.",
      operationalStatus: "Stato operativo",
      readyPercentage: "{{percentage}}% pronto",
      actionRequired: "Intervento richiesto",
      workspaceStable: "Workspace stabile",
      dirty: "sporchi",
      behind: "behind",
      ahead: "ahead",
      runtime: "Runtime",
      dockerOnline: "Docker online",
      unavailable: "non disponibile",
      containersRunning: "{{count}} container in esecuzione",
      runtimeNotDetected: "Runtime non rilevato",
      groups: "gruppi",
      containers: "container",
      openRuntime: "Apri runtime",
      recentCommits: "Commit recenti",
      activityCount: "{{count}} attività",
      noCommit: "Nessun commit",
      noCommitsDetected: "Nessun commit rilevato.",
      perspective: "Prospettiva",
      anotherQuote: "Mostra un’altra citazione",
      clean: "pulito",
      modifiedShort: "{{count}} mod.",
      runtimeStatus: {
        offline: "offline",
        running: "in esecuzione",
        stopped: "arrestato"
      }
    },
    pulse: {
      snapshot: "Snapshot operativo",
      title: "Segnali workspace",
      ready: "pronto",
      distribution: "Distribuzione operativa: {{description}}",
      emptySignals: "I segnali compariranno dopo la prima scansione del workspace.",
      changeConcentration: "Concentrazione modifiche",
      changeDescription: "Dove si trova il carico locale, ordinato per volume",
      changeLegend: "Legenda tipi di modifica",
      staged: "Staged",
      modified: "Modificati",
      untracked: "Nuovi",
      treesAligned: "Working tree allineati",
      noLocalChanges: "Nessuna modifica locale da distribuire.",
      openProject: "Apri {{name}}, {{count}} file modificati",
      branchNotDetected: "branch non rilevata",
      changesAria: "{{staged}} staged, {{modified}} modificati, {{untracked}} nuovi",
      blocked: "Bloccati",
      action: "Da gestire",
      ahead: "Ahead",
      readySignal: "Pronti"
    }
  },
  loading: {
    tasks: "Caricamento task engineering",
    agents: "Rilevamento sessioni agent",
    automations: "Caricamento automazioni"
  },
  errors: {
    pickFolder: "Impossibile selezionare la cartella",
    scanWorkspace: "Impossibile scansionare il workspace. Scegli una cartella più specifica e riprova.",
    stopDocker: "Impossibile arrestare i container Docker"
  },
  workspaceState: {
    unavailableTitle: "Dati del workspace non disponibili",
    unavailableDescription: "repo-control non è riuscito a leggere questo workspace, quindi non viene mostrata alcuna valutazione sullo stato dei repository.",
    staleTitle: "Aggiornamento workspace non riuscito",
    staleDescription: "Viene mostrata l’ultima snapshot riuscita del {{lastUpdated}}.",
    retry: "Riprova",
    retrying: "Nuovo tentativo…",
    changeWorkspace: "Cambia workspace",
    unknownError: "La richiesta del workspace non è riuscita per un motivo sconosciuto.",
    unknownUpdateTime: "un momento sconosciuto"
  },
  operations: {
    title: "Cronologia operazioni",
    history: "Operazioni",
    historyAria: "Operazioni recenti sui repository",
    openHistoryAria: "Apri cronologia operazioni, {{count}} operazioni",
    details: "Dettagli",
    dismiss: "Chiudi notifica operazione",
    completed: "{{source}} completata",
    failed: "{{source}} non riuscita",
    success: "Riuscita",
    failure: "Non riuscita",
    scope: "Ambito",
    command: "Comando",
    exitCode: "Codice di uscita",
    duration: "Durata",
    output: "Output",
    noOutput: "L’operazione non ha restituito output.",
    clear: "Svuota cronologia",
    copy: "Copia dettagli",
    copied: "Copiati",
    copyFailed: "Copia non riuscita",
    close: "Chiudi",
    sources: {
      overview: "Azione repository",
      changes: "Modifiche Git",
      branches: "Branch Git",
      docker: "Azione Docker"
    }
  },
  settings: {
    eyebrow: "Preferenze workspace",
    title: "Impostazioni",
    description: "Adatta repo-control al tuo modo di lavorare. Le preferenze vengono salvate localmente su questo dispositivo.",
    general: "Generali",
    generalDescription: "Lingua e preferenze regionali",
    languageAndRegion: "Lingua e area geografica",
    languageTitle: "Lingua dell’interfaccia",
    languageDescription: "Scegli la lingua usata per navigazione, controlli e messaggi di sistema.",
    languageFieldLabel: "Scegli la lingua dell’interfaccia",
    english: "Inglese",
    englishNative: "English",
    italian: "Italiano",
    italianNative: "Italiano",
    active: "Attiva",
    savedAutomatically: "Le modifiche vengono salvate automaticamente",
    immediateNote: "L’interfaccia si aggiorna subito. La scelta verrà ricordata alla prossima apertura di repo-control.",
    localPreference: "Salvata su questo dispositivo",
    translationEngine: "Traduzioni gestite con i18next"
  }
};

export const resources = {
  en: { translation: en },
  it: { translation: it }
} as const;
