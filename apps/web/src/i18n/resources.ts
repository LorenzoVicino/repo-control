export const en = {
  common: {
    repository: "Repository",
    workspace: "Workspace",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    delete: "Delete"
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
  preferenceState: {
    loadTitle: "Favorites unavailable",
    loadDescription: "repo-control could not load your saved favorites. Favorite changes are paused until this recovers.",
    migrationTitle: "Favorites were not migrated",
    migrationDescription: "Your legacy favorites remain on this device, and the previous server selection has been restored.",
    saveTitle: "Favorite change was not saved",
    saveDescription: "The last confirmed favorite selection has been restored.",
    retry: "Retry",
    retrying: "Retrying…",
    dismiss: "Dismiss",
    unknownError: "The preference request failed for an unknown reason."
  },
  projectDataState: {
    unavailableTitle: "{{resource}} unavailable",
    unavailableDescription: "repo-control could not load the live data required by this repository view.",
    partialTitle: "Some live project data is unavailable",
    partialDescription: "Available repository information remains visible; affected data may be missing or stale.",
    retry: "Retry",
    retrying: "Retrying…",
    unknownError: "The project data request failed for an unknown reason.",
    resources: {
      gitDetails: "Git details",
      gitActivity: "Git activity",
      dockerCompose: "Docker Compose status"
    }
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
  },
  automation: {
    boardLabel: "Automation board",
    selectWorkflow: "Select workflow",
    newWorkflow: "New",
    createWorkflow: "Create workflow",
    createAutomation: "Create automation",
    activeWorkflow: "Active workflow",
    refreshWorkflows: "Refresh workflows",
    noWorkflowSelected: "No workflow selected",
    operationFailed: "Operation failed",
    yourWorkflows: "Your workflows",
    workflowTotal: "{{total}} total",
    searchWorkflows: "Search workflows",
    noWorkflows: "No workflows",
    noWorkflowsHint: "Start from a template and customize the flow.",
    noSearchResults: "No results for “{{query}}”.",
    nodeTotal: "{{total}} nodes",
    workflowReady: "Workflow ready",
    workflowIncomplete: "Workflow needs completing",
    runsTitle: "Runs",
    runsSubtitle: "History for the selected workflow",
    noRuns: "No runs recorded",
    runInProgress: "In progress…",
    runSummary: "{{repositories}} repositories · {{commands}} commands",
    previewChip: "Preview",
    runChip: "Run",
    runStatus: {
      failed: "Failed",
      warning: "With warnings",
      pending: "Queued",
      running: "Running",
      cancelled: "Cancelled",
      interrupted: "Interrupted",
      succeeded: "Succeeded"
    },
    palette: {
      title: "Node library",
      available: "{{total}} steps available",
      close: "Close node library",
      searchPlaceholder: "Search for a step...",
      searchLabel: "Search the node library",
      noResults: "No steps found",
      noResultsHint: "Try “Git”, “Docker” or “input”."
    },
    groups: {
      trigger: "Trigger",
      input: "Input",
      repository: "Repository",
      git: "Git",
      docker: "Docker",
      commands: "Commands",
      output: "Output"
    },
    nodeTypes: {
      trigger: {
        manual: { label: "Manual trigger", description: "Entry point of the workflow" }
      },
      input: {
        text: { label: "Text input", description: "Ask for a value before running" }
      },
      repository: {
        select: { label: "Select repositories", description: "All, favorites or a manual selection" },
        filter: { label: "Filter repositories", description: "Local state, sync and Docker" }
      },
      git: {
        fetch: { label: "Git fetch", description: "Update every remote reference" },
        pull: { label: "Git pull", description: "Fast-forward pull of the current branch" },
        pullDevelop: { label: "Pull develop", description: "Update from origin/develop" },
        push: { label: "Git push", description: "Send the current branch to the remote" }
      },
      docker: {
        up: { label: "Compose up", description: "Start the services in the background" },
        rebuild: { label: "Compose rebuild", description: "Rebuild and start the services" },
        stop: { label: "Compose stop", description: "Stop the project services" }
      },
      terminal: {
        command: { label: "Terminal command", description: "Run a command in every repository" }
      },
      output: {
        summary: { label: "Summary", description: "Close the flow with a summary" }
      }
    },
    nodeSummary: {
      inputRequired: "{{key}} · required",
      inputOptional: "{{key}} · optional",
      inputKeyMissing: "Key not configured",
      repositoriesFavorites: "Favorite repositories",
      repositoriesManual: "{{total}} selected",
      repositoriesAll: "All repositories",
      noFilter: "No filter",
      cleanOnly: "Clean checkouts only",
      allowDirty: "Allow local changes",
      commandMissing: "Command not configured",
      defaultInputLabel: "Input"
    },
    unsaved: {
      title: "Unsaved changes",
      body: "If you continue, the changes made to “{{name}}” will be lost.",
      thisWorkflow: "this workflow",
      stay: "Stay here",
      discard: "Discard and continue"
    },
    inspector: {
      title: "Configuration",
      close: "Close node configuration",
      noSelection: "No node selected",
      nodeName: "Node name",
      key: "Key",
      keyHelp: "Start with a lowercase letter; use only letters, numbers and underscores.",
      inputNotice: "The value is requested before a preview or a run. Do not use this node for passwords or tokens.",
      label: "Label",
      description: "Description",
      placeholder: "Placeholder",
      defaultValue: "Default value",
      required: "Required input",
      multiline: "Multi-line text",
      selection: "Selection",
      modes: { all: "All", favorites: "Favorites", manual: "Manual" },
      checkout: "Checkout",
      checkoutOptions: { any: "Any", clean: "Clean", dirty: "With changes" },
      sync: "Sync",
      syncOptions: { any: "Any", behind: "Behind", ahead: "Ahead", diverged: "Diverged" },
      docker: "Docker Compose",
      dockerOptions: { any: "Any", yes: "Present", no: "Absent" },
      requireClean: "Require a clean checkout",
      command: "Command",
      deleteNode: "Delete node"
    },
    editor: {
      connectionRule: "Each node can have only one input and one output; cycles are not supported.",
      needsNode: "The workflow must contain at least one node.",
      needsName: "Enter a name for the workflow.",
      namePlaceholder: "Workflow name",
      nameAriaLabel: "Workflow name",
      viewAriaLabel: "Automation view",
      canvasAriaLabel: "Automation canvas",
      historyTitle: "History",
      historySubtitle: "Check the results, duration and status of the latest runs.",
      backToEditor: "Back to the editor",
      descriptionPlaceholder: "Add a description",
      descriptionAriaLabel: "Workflow description",
      runsAriaLabel: "Workflow runs",
      readyChip: "Ready",
      incompleteChip: "To complete",
      tabEditor: "Editor",
      saveTooltip: "Save changes",
      nothingToSave: "No changes to save",
      unsavedIndicator: "Unsaved changes",
      dryRunTooltip: "Check the actions without applying them",
      runLabel: "Run",
      deleteWorkflow: "Delete workflow",
      deleteBody: "The workflow “{{name}}” will be removed permanently.",
      configure: "Configure",
      addStep: "Add step"
    },
    run: {
      executionChip: "Execution",
      failedAlert: "The run stopped at the first failed step. Open the detail to fix the problem.",
      warningAlert: "The run finished, but one or more commands were skipped.",
      irregularAlert: "The run did not finish normally.",
      activeAlert: "The run continues in the background: you can close this window, progress keeps going and stays visible in the history.",
      repositoriesChip: "{{total}} repositories",
      succeededChip: "{{total}} succeeded",
      skippedChip: "{{total}} skipped",
      failedChip: "{{total}} failed",
      cancelRun: "Cancel run",
      stepStatus: {
        failed: "Failed",
        skipped: "Skipped",
        cancelled: "Cancelled",
        succeeded: "Succeeded"
      }
    },
    execution: {
      previewTitle: "Preview workflow",
      runTitle: "Run workflow",
      previewDescription: "Generate the preview of “{{name}}” with the values for this run.",
      runDescription: "Start “{{name}}” on the current workspace.",
      willSaveChanges: "The current changes will be saved before generating this run.",
      inputsNotice: "These values apply to this run only. Do not enter passwords or tokens.",
      noInputs_one: "The workflow contains {{count}} node and requires no input.",
      noInputs_other: "The workflow contains {{count}} nodes and requires no input.",
      generatePreview: "Generate preview",
      startRun: "Start run"
    },
    create: {
      title: "New automation",
      subtitle: "Start from a ready-made base or build the flow from scratch.",
      nameLabel: "Name",
      descriptionLabel: "Description",
      chooseBase: "Choose a base",
      templateAriaLabel: "Automation template",
      creating: "Creating",
      templates: {
        empty: {
          title: "From scratch",
          description: "Only the trigger node, to complete however you like."
        },
        syncFavorites: {
          title: "Sync favorites",
          description: "Safe fetch and pull of clean, favorite repositories."
        },
        dockerUp: {
          title: "Start Docker",
          description: "Select the Compose projects and start the services."
        }
      }
    },
    issues: {
      duplicateNodeId: "The identifier of node “{{name}}” is duplicated.",
      singleTrigger: "The workflow must have exactly one manual trigger node.",
      needsAction: "Add at least one Git, Docker or terminal action.",
      commandRequired: "Configure the command in node “{{name}}”.",
      repositorySelectionRequired: "Select at least one repository in node “{{name}}”.",
      edgeMissingNode: "A connection references a node that no longer exists.",
      selfConnection: "Node “{{name}}” cannot connect to itself.",
      multipleOutputs: "Node “{{name}}” has more than one output.",
      multipleInputs: "Node “{{name}}” has more than one input.",
      triggerMustBeFirst: "The trigger node must be the first of the flow.",
      summaryMustBeLast: "The summary “{{name}}” must be the last node.",
      cycle: "The workflow contains a cycle.",
      disconnectedNodes: "Connect {{names}} to the trigger.",
      disconnectedNodesMore: "Connect {{names}} and {{remaining}} more nodes to the trigger.",
      noRepositorySelectWarning: "Without a selection node, the actions apply to every repository.",
      noSummaryWarning: "Add a final summary to make the outcome easier to read.",
      tooManyInputs: "A workflow can contain at most {{max}} text inputs.",
      invalidInputKey: "The key “{{key}}” must start with a lowercase letter and contain only lowercase letters, numbers or underscores.",
      duplicateInputKey: "The input key “{{key}}” is used more than once.",
      invalidInputReference: "Command “{{name}}” contains an invalid input reference.",
      undefinedInputReference: "Command “{{name}}” uses the input “{{key}}”, which is not defined.",
      incompleteInputReference: "Command “{{name}}” contains an incomplete input reference.",
      emptyInputKey: "(empty)",
      valueRequired: "This value is required"
    }
  }
} as const;

type TranslationSchema<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationSchema<T[Key]>;
};

export const it: TranslationSchema<typeof en> = {
  common: {
    repository: "Repository",
    workspace: "Workspace",
    cancel: "Annulla",
    save: "Salva",
    close: "Chiudi",
    delete: "Elimina"
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
  preferenceState: {
    loadTitle: "Preferiti non disponibili",
    loadDescription: "repo-control non è riuscito a caricare i preferiti salvati. Le modifiche ai preferiti sono sospese fino al ripristino.",
    migrationTitle: "Preferiti non migrati",
    migrationDescription: "I preferiti precedenti restano su questo dispositivo ed è stata ripristinata l'ultima selezione salvata sul server.",
    saveTitle: "Modifica ai preferiti non salvata",
    saveDescription: "È stata ripristinata l'ultima selezione di preferiti confermata.",
    retry: "Riprova",
    retrying: "Nuovo tentativo…",
    dismiss: "Ignora",
    unknownError: "La richiesta delle preferenze non è riuscita per un motivo sconosciuto."
  },
  projectDataState: {
    unavailableTitle: "Dati non disponibili: {{resource}}",
    unavailableDescription: "repo-control non è riuscito a caricare i dati live richiesti da questa vista del repository.",
    partialTitle: "Alcuni dati live del progetto non sono disponibili",
    partialDescription: "Le informazioni disponibili restano visibili; i dati interessati potrebbero essere mancanti o non aggiornati.",
    retry: "Riprova",
    retrying: "Nuovo tentativo…",
    unknownError: "La richiesta dei dati del progetto non è riuscita per un motivo sconosciuto.",
    resources: {
      gitDetails: "Dettagli Git",
      gitActivity: "Attività Git",
      dockerCompose: "Stato Docker Compose"
    }
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
  },
  automation: {
    boardLabel: "Lavagna automazioni",
    selectWorkflow: "Seleziona workflow",
    newWorkflow: "Nuovo",
    createWorkflow: "Crea workflow",
    createAutomation: "Crea automazione",
    activeWorkflow: "Workflow attivo",
    refreshWorkflows: "Aggiorna workflow",
    noWorkflowSelected: "Nessun workflow selezionato",
    operationFailed: "Operazione non riuscita",
    yourWorkflows: "I tuoi workflow",
    workflowTotal: "{{total}} totali",
    searchWorkflows: "Cerca workflow",
    noWorkflows: "Nessun workflow",
    noWorkflowsHint: "Parti da un template e personalizza il flusso.",
    noSearchResults: "Nessun risultato per “{{query}}”.",
    nodeTotal: "{{total}} nodi",
    workflowReady: "Workflow pronto",
    workflowIncomplete: "Workflow da completare",
    runsTitle: "Esecuzioni",
    runsSubtitle: "Cronologia del workflow selezionato",
    noRuns: "Nessuna esecuzione registrata",
    runInProgress: "In corso…",
    runSummary: "{{repositories}} repository · {{commands}} comandi",
    previewChip: "Anteprima",
    runChip: "Run",
    runStatus: {
      failed: "Fallita",
      warning: "Con avvisi",
      pending: "In coda",
      running: "In corso",
      cancelled: "Annullata",
      interrupted: "Interrotta",
      succeeded: "Riuscita"
    },
    palette: {
      title: "Libreria nodi",
      available: "{{total}} passaggi disponibili",
      close: "Chiudi libreria nodi",
      searchPlaceholder: "Cerca un passaggio...",
      searchLabel: "Cerca nella libreria nodi",
      noResults: "Nessun passaggio trovato",
      noResultsHint: "Prova con “Git”, “Docker” o “input”."
    },
    groups: {
      trigger: "Avvio",
      input: "Input",
      repository: "Repository",
      git: "Git",
      docker: "Docker",
      commands: "Comandi",
      output: "Output"
    },
    nodeTypes: {
      trigger: {
        manual: { label: "Avvio manuale", description: "Punto di ingresso del workflow" }
      },
      input: {
        text: { label: "Input di testo", description: "Richiedi un valore prima dell’esecuzione" }
      },
      repository: {
        select: { label: "Seleziona repository", description: "Tutti, preferiti o selezione manuale" },
        filter: { label: "Filtra repository", description: "Stato locale, sync e Docker" }
      },
      git: {
        fetch: { label: "Git fetch", description: "Aggiorna tutti i riferimenti remoti" },
        pull: { label: "Git pull", description: "Pull fast-forward del branch corrente" },
        pullDevelop: { label: "Pull develop", description: "Aggiorna da origin/develop" },
        push: { label: "Git push", description: "Invia il branch corrente al remoto" }
      },
      docker: {
        up: { label: "Compose up", description: "Avvia i servizi in background" },
        rebuild: { label: "Compose rebuild", description: "Ricostruisce e avvia i servizi" },
        stop: { label: "Compose stop", description: "Ferma i servizi del progetto" }
      },
      terminal: {
        command: { label: "Comando terminale", description: "Esegue un comando in ogni repository" }
      },
      output: {
        summary: { label: "Riepilogo", description: "Chiude il flusso con un riepilogo" }
      }
    },
    nodeSummary: {
      inputRequired: "{{key}} · obbligatorio",
      inputOptional: "{{key}} · opzionale",
      inputKeyMissing: "Chiave da configurare",
      repositoriesFavorites: "Repository preferiti",
      repositoriesManual: "{{total}} selezionati",
      repositoriesAll: "Tutti i repository",
      noFilter: "Nessun filtro",
      cleanOnly: "Solo checkout puliti",
      allowDirty: "Consenti modifiche locali",
      commandMissing: "Comando da configurare",
      defaultInputLabel: "Input"
    },
    unsaved: {
      title: "Modifiche non salvate",
      body: "Se continui, le modifiche apportate a “{{name}}” verranno perse.",
      thisWorkflow: "questo workflow",
      stay: "Resta qui",
      discard: "Scarta e continua"
    },
    inspector: {
      title: "Configurazione",
      close: "Chiudi configurazione nodo",
      noSelection: "Nessun nodo selezionato",
      nodeName: "Nome nodo",
      key: "Chiave",
      keyHelp: "Inizia con una lettera minuscola; usa solo lettere, numeri e underscore.",
      inputNotice: "Il valore viene richiesto prima di anteprima o esecuzione. Non utilizzare questo nodo per password o token.",
      label: "Etichetta",
      description: "Descrizione",
      placeholder: "Placeholder",
      defaultValue: "Valore predefinito",
      required: "Input obbligatorio",
      multiline: "Testo su più righe",
      selection: "Selezione",
      modes: { all: "Tutti", favorites: "Preferiti", manual: "Manuale" },
      checkout: "Checkout",
      checkoutOptions: { any: "Qualsiasi", clean: "Pulito", dirty: "Con modifiche" },
      sync: "Sincronizzazione",
      syncOptions: { any: "Qualsiasi", behind: "Da aggiornare", ahead: "Da pubblicare", diverged: "Divergente" },
      docker: "Docker Compose",
      dockerOptions: { any: "Qualsiasi", yes: "Presente", no: "Assente" },
      requireClean: "Richiedi checkout pulito",
      command: "Comando",
      deleteNode: "Elimina nodo"
    },
    editor: {
      connectionRule: "Ogni nodo può avere una sola entrata e una sola uscita; i cicli non sono supportati.",
      needsNode: "Il workflow deve contenere almeno un nodo.",
      needsName: "Inserisci un nome per il workflow.",
      namePlaceholder: "Nome workflow",
      nameAriaLabel: "Nome workflow",
      viewAriaLabel: "Vista automazione",
      canvasAriaLabel: "Canvas automazione",
      historyTitle: "Cronologia",
      historySubtitle: "Controlla risultati, durata e stato delle ultime esecuzioni.",
      backToEditor: "Torna all’editor",
      descriptionPlaceholder: "Aggiungi una descrizione",
      descriptionAriaLabel: "Descrizione workflow",
      runsAriaLabel: "Esecuzioni workflow",
      readyChip: "Pronto",
      incompleteChip: "Da completare",
      tabEditor: "Editor",
      saveTooltip: "Salva modifiche",
      nothingToSave: "Nessuna modifica da salvare",
      unsavedIndicator: "Modifiche non salvate",
      dryRunTooltip: "Controlla le azioni senza applicarle",
      runLabel: "Esegui",
      deleteWorkflow: "Elimina workflow",
      deleteBody: "Il workflow “{{name}}” verrà rimosso definitivamente.",
      configure: "Configura",
      addStep: "Aggiungi passaggio"
    },
    run: {
      executionChip: "Esecuzione",
      failedAlert: "L’esecuzione si è fermata al primo step fallito. Apri il dettaglio per correggere il problema.",
      warningAlert: "L’esecuzione è terminata, ma uno o più comandi sono stati saltati.",
      irregularAlert: "L’esecuzione non è terminata regolarmente.",
      activeAlert: "L’esecuzione è in corso in background: puoi chiudere questa finestra, il progresso continua e resta visibile nello storico.",
      repositoriesChip: "{{total}} repository",
      succeededChip: "{{total}} riusciti",
      skippedChip: "{{total}} saltati",
      failedChip: "{{total}} falliti",
      cancelRun: "Annulla esecuzione",
      stepStatus: {
        failed: "Fallito",
        skipped: "Saltato",
        cancelled: "Annullato",
        succeeded: "Riuscito"
      }
    },
    execution: {
      previewTitle: "Anteprima workflow",
      runTitle: "Esegui workflow",
      previewDescription: "Genera l’anteprima di “{{name}}” con i valori di questa esecuzione.",
      runDescription: "Avvia “{{name}}” sul workspace corrente.",
      willSaveChanges: "Le modifiche correnti verranno salvate prima di generare questa esecuzione.",
      inputsNotice: "Questi valori valgono solo per questa esecuzione. Non inserire password o token.",
      noInputs_one: "Il workflow contiene {{count}} nodo e non richiede input.",
      noInputs_other: "Il workflow contiene {{count}} nodi e non richiede input.",
      generatePreview: "Genera anteprima",
      startRun: "Avvia esecuzione"
    },
    create: {
      title: "Nuova automazione",
      subtitle: "Parti da una base pronta oppure costruisci il flusso da zero.",
      nameLabel: "Nome",
      descriptionLabel: "Descrizione",
      chooseBase: "Scegli una base",
      templateAriaLabel: "Template automazione",
      creating: "Creazione",
      templates: {
        empty: {
          title: "Da zero",
          description: "Solo il nodo di avvio, da completare liberamente."
        },
        syncFavorites: {
          title: "Sincronizza preferiti",
          description: "Fetch e pull sicuro dei repository preferiti e puliti."
        },
        dockerUp: {
          title: "Avvia Docker",
          description: "Seleziona i progetti Compose e avvia i servizi."
        }
      }
    },
    issues: {
      duplicateNodeId: "L’identificativo del nodo “{{name}}” è duplicato.",
      singleTrigger: "Il workflow deve avere un solo nodo di avvio manuale.",
      needsAction: "Aggiungi almeno un’azione Git, Docker o terminale.",
      commandRequired: "Configura il comando nel nodo “{{name}}”.",
      repositorySelectionRequired: "Seleziona almeno un repository nel nodo “{{name}}”.",
      edgeMissingNode: "Una connessione fa riferimento a un nodo che non esiste più.",
      selfConnection: "Il nodo “{{name}}” non può collegarsi a sé stesso.",
      multipleOutputs: "Il nodo “{{name}}” ha più di un’uscita.",
      multipleInputs: "Il nodo “{{name}}” ha più di un ingresso.",
      triggerMustBeFirst: "Il nodo di avvio deve essere il primo del flusso.",
      summaryMustBeLast: "Il riepilogo “{{name}}” deve essere l’ultimo nodo.",
      cycle: "Il workflow contiene un ciclo.",
      disconnectedNodes: "Collega all’avvio {{names}}.",
      disconnectedNodesMore: "Collega all’avvio {{names}} e altri {{remaining}} nodi.",
      noRepositorySelectWarning: "Senza un nodo di selezione, le azioni verranno applicate a tutti i repository.",
      noSummaryWarning: "Aggiungi un riepilogo finale per rendere l’esito più leggibile.",
      tooManyInputs: "Un workflow può contenere al massimo {{max}} input di testo.",
      invalidInputKey: "La chiave “{{key}}” deve iniziare con una lettera minuscola e contenere solo lettere minuscole, numeri o underscore.",
      duplicateInputKey: "La chiave input “{{key}}” è utilizzata più di una volta.",
      invalidInputReference: "Il comando “{{name}}” contiene un riferimento input non valido.",
      undefinedInputReference: "Il comando “{{name}}” utilizza l’input “{{key}}”, che non è definito.",
      incompleteInputReference: "Il comando “{{name}}” contiene un riferimento input incompleto.",
      emptyInputKey: "(vuota)",
      valueRequired: "Questo valore è obbligatorio"
    }
  }
};

export const resources = {
  en: { translation: en },
  it: { translation: it }
} as const;
