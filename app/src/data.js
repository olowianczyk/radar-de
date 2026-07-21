// HR Business Partner Platform — Legal-change monitoring: trilingual strings + demo data.
export const HRBP_I18N = {
  pl: {
    app: "Monitoring zmian w prawie pracy", nav: { feed: "Zmiany w przepisach", kb: "Baza wiedzy", sources: "Monitorowane źródła", settings: "Ustawienia" },
    greet: "Dzień dobry", greetSub: "Wykryto {n} nowe zmiany w przepisach wymagające przeglądu",
    kpi: { new: "Nowe zmiany", pending: "Do wdrożenia", tracked: "Monitorowane akty", updated: "Wdrożone w tym mies." },
    recent: "Najnowsze zmiany", all: "Wszystkie zmiany",
    area: { leave: "Urlopy", pay: "Wynagrodzenia i płace", safety: "BHP", contracts: "Umowy o pracę", social: "Ubezpieczenia społeczne", other: "Inne" },
    st: { new: "Nowe", progress: "W przeglądzie", waiting: "Oczekuje", urgent: "Pilne", done: "Wdrożone" },
    tabs: { all: "Wszystkie", new: "Nowe", urgent: "Pilne", done: "Wdrożone" },
    search: "Szukaj aktu prawnego, zmiany lub dokumentu…", filterArea: "Obszar prawa", allAreas: "Wszystkie obszary", clearFilters: "Wyczyść filtry", exportCsv: "Eksportuj CSV", exportPdf: "Eksportuj PDF", selectAll: "Zaznacz wszystkie", clearSelection: "Wyczyść zaznaczenie", selectedCount: "Zaznaczono: {n}", bulkMarkReviewed: "Oznacz jako przejrzane",
    source: "Źródło", published: "Data publikacji", effective: "Wejście w życie", affected: "Powiązane dokumenty",
    markReviewed: "Oznacz jako przejrzane", updateDoc: "Oznacz jako wdrożone", detailEmpty: "Wybierz zmianę, aby zobaczyć szczegóły",
    kbTitle: "Baza wiedzy", kbSub: "Polityki, procedury i szablony HR", needsUpdate: "Wymaga aktualizacji",
    kbAll: "Wszystkie", kbFavorites: "Ulubione", addFavorite: "Dodaj do ulubionych", removeFavorite: "Usuń z ulubionych", kbNoFavorites: "Brak ulubionych dokumentów", kbNoFavoritesSub: "Oznacz dokument gwiazdką, aby szybciej go znaleźć.",
    sortBy: "Sortuj", sortTitle: "Tytuł (A–Z)", sortUpdated: "Ostatnio aktualizowane", sortNeedsUpdate: "Wymaga aktualizacji",
    versionHistory: "Historia wersji", hideVersionHistory: "Ukryj historię wersji", version: "Wersja", currentVersion: "Bieżąca",
    updated: "Ostatnia aktualizacja", relatedChanges: "Powiązane zmiany w przepisach", kbEmpty: "Wybierz dokument, aby zobaczyć treść",
    discussion: "Dyskusja", commentPlaceholder: "Dodaj komentarz lub pytanie do tego dokumentu…", postComment: "Dodaj komentarz", noComments: "Brak komentarzy — rozpocznij dyskusję.", commentsCount: "{n} komentarzy",
    attachments: "Załączniki", noAttachments: "Brak załączników.", addAttachment: "Dodaj załącznik", uploadedBy: "Dodane przez",
    sourcesTitle: "Monitorowane źródła", sourcesSub: "Akty prawne z ISAP (isap.sejm.gov.pl) — zawsze tekst ujednolicony — skanowane automatycznie pod kątem zmian",
    lastChecked: "Ostatnie sprawdzenie", changesFound: "Wykryte zmiany", monitoring: "Monitorowanie",
    checkNow: "Sprawdź teraz", scanning: "Skanowanie…", scanDone: "Skanowanie zakończone",
    periodLabel: "Okres", periodAll: "Wszystkie", periodCustom: "Niestandardowy zakres", periodFrom: "Od dnia", periodTo: "Do dnia", scanPeriod: "Okres skanowania",
    periodQuarter: "Ostatni kwartał", period6m: "Ostatnie 6 miesięcy", periodYear: "Ostatni rok",
    periodPrevYear: "Poprzedni rok", periodCurYear: "Bieżący rok",
    history: "Historia", hideHistory: "Ukryj historię", evScan: "Skanowanie ukończone — bez zmian", evDetected: "Wykryto zmianę", evPaused: "Monitorowanie wstrzymane", evResumed: "Monitorowanie wznowione",
    feedEmptyTitle: "Brak zmian w tej kategorii", feedEmptySub: "Gdy system wykryje nową zmianę pasującą do tego filtra, pojawi się tutaj.",
    kbNoResults: "Brak wyników", kbNoResultsSub: "Nie znaleziono dokumentów pasujących do wyszukiwania.",
    kbEmptyAll: "Brak dokumentów", kbEmptyAllSub: "Baza wiedzy jest pusta — dodaj pierwszy dokument.",
    login: { title: "Zaloguj się", subtitle: "System wsparcia HR BP", email: "Adres e-mail", password: "Hasło", remember: "Zapamiętaj mnie", submit: "Zaloguj", forgot: "Nie pamiętasz hasła?", error: "Nieprawidłowy e-mail lub hasło.", sso: "Zaloguj przez firmowe SSO" },
    settings: { title: "Ustawienia", profile: "Profil", account: "Konto", preferences: "Preferencje", role: "Stanowisko", dept: "Dział", language: "Język interfejsu", darkMode: "Tryb ciemny", signOut: "Wyloguj się", saved: "Zapisano zmiany" },
    roleHrbp: "HR Business Partner", roleViewer: "Tylko podgląd",
    permissions: "Uprawnienia", permissionsSub: "Poziom dostępu decyduje, jakie akcje można wykonywać w systemie.",
    readOnlyNotice: "Tryb tylko do odczytu — zmiana ustawień wymaga roli HR Business Partner.",
    notifications: "Powiadomienia", notificationsEmpty: "Brak nowych powiadomień", notifKbNeedsUpdate: "Dokument wymaga aktualizacji", markAllRead: "Oznacz wszystkie jako przeczytane",
  },
  de: {
    app: "Überwachung arbeitsrechtlicher Änderungen", nav: { feed: "Rechtsänderungen", kb: "Wissensbasis", sources: "Überwachte Quellen", settings: "Einstellungen" },
    greet: "Guten Morgen", greetSub: "{n} neue Rechtsänderungen zur Prüfung erkannt",
    kpi: { new: "Neue Änderungen", pending: "Zur Umsetzung", tracked: "Überwachte Rechtsakte", updated: "Umgesetzt diesen Monat" },
    recent: "Neueste Änderungen", all: "Alle Änderungen",
    area: { leave: "Urlaub", pay: "Vergütung", safety: "Arbeitsschutz", contracts: "Arbeitsverträge", social: "Sozialversicherung", other: "Sonstiges" },
    st: { new: "Neu", progress: "In Prüfung", waiting: "Wartet", urgent: "Dringend", done: "Umgesetzt" },
    tabs: { all: "Alle", new: "Neu", urgent: "Dringend", done: "Umgesetzt" },
    search: "Rechtsakt, Änderung oder Dokument suchen…", filterArea: "Rechtsgebiet", allAreas: "Alle Rechtsgebiete", clearFilters: "Filter zurücksetzen", exportCsv: "Als CSV exportieren", exportPdf: "Als PDF exportieren", selectAll: "Alle auswählen", clearSelection: "Auswahl aufheben", selectedCount: "{n} ausgewählt", bulkMarkReviewed: "Als geprüft markieren",
    source: "Quelle", published: "Veröffentlicht", effective: "In Kraft ab", affected: "Betroffene Dokumente",
    markReviewed: "Als geprüft markieren", updateDoc: "Als umgesetzt markieren", detailEmpty: "Wählen Sie eine Änderung für Details",
    kbTitle: "Wissensbasis", kbSub: "HR-Richtlinien, Verfahren und Vorlagen", needsUpdate: "Aktualisierung nötig",
    kbAll: "Alle", kbFavorites: "Favoriten", addFavorite: "Zu Favoriten hinzufügen", removeFavorite: "Aus Favoriten entfernen", kbNoFavorites: "Keine Favoriten", kbNoFavoritesSub: "Markieren Sie ein Dokument mit einem Stern, um es schneller zu finden.",
    sortBy: "Sortieren", sortTitle: "Titel (A–Z)", sortUpdated: "Zuletzt aktualisiert", sortNeedsUpdate: "Aktualisierung nötig",
    versionHistory: "Versionsverlauf", hideVersionHistory: "Versionsverlauf ausblenden", version: "Version", currentVersion: "Aktuell",
    updated: "Zuletzt aktualisiert", relatedChanges: "Zugehörige Rechtsänderungen", kbEmpty: "Wählen Sie ein Dokument für den Inhalt",
    discussion: "Diskussion", commentPlaceholder: "Kommentar oder Frage zu diesem Dokument hinzufügen…", postComment: "Kommentar posten", noComments: "Keine Kommentare — starten Sie die Diskussion.", commentsCount: "{n} Kommentare",
    attachments: "Anhänge", noAttachments: "Keine Anhänge.", addAttachment: "Anhang hinzufügen", uploadedBy: "Hochgeladen von",
    sourcesTitle: "Überwachte Quellen", sourcesSub: "Rechtsakte aus ISAP (isap.sejm.gov.pl) — stets konsolidierter Text — automatisch auf Änderungen gescannt",
    lastChecked: "Zuletzt geprüft", changesFound: "Gefundene Änderungen", monitoring: "Überwachung",
    checkNow: "Jetzt prüfen", scanning: "Scanne…", scanDone: "Scan abgeschlossen",
    periodLabel: "Zeitraum", periodAll: "Alle", periodCustom: "Benutzerdefinierter Zeitraum", periodFrom: "Ab dem", periodTo: "Bis zum", scanPeriod: "Scan-Zeitraum",
    periodQuarter: "Letztes Quartal", period6m: "Letzte 6 Monate", periodYear: "Letztes Jahr",
    periodPrevYear: "Vorjahr", periodCurYear: "Laufendes Jahr",
    history: "Verlauf", hideHistory: "Verlauf ausblenden", evScan: "Scan abgeschlossen — keine Änderungen", evDetected: "Änderung erkannt", evPaused: "Überwachung pausiert", evResumed: "Überwachung fortgesetzt",
    feedEmptyTitle: "Keine Änderungen in dieser Kategorie", feedEmptySub: "Sobald das System eine passende Änderung erkennt, erscheint sie hier.",
    kbNoResults: "Keine Ergebnisse", kbNoResultsSub: "Es wurden keine Dokumente zu dieser Suche gefunden.",
    kbEmptyAll: "Keine Dokumente", kbEmptyAllSub: "Die Wissensbasis ist leer — fügen Sie das erste Dokument hinzu.",
    login: { title: "Anmelden", subtitle: "HR-BP-Supportsystem", email: "E-Mail-Adresse", password: "Passwort", remember: "Angemeldet bleiben", submit: "Anmelden", forgot: "Passwort vergessen?", error: "Ungültige E-Mail oder Passwort.", sso: "Mit Firmen-SSO anmelden" },
    settings: { title: "Einstellungen", profile: "Profil", account: "Konto", preferences: "Einstellungen", role: "Position", dept: "Abteilung", language: "Sprache", darkMode: "Dunkelmodus", signOut: "Abmelden", saved: "Änderungen gespeichert" },
    roleHrbp: "HR Business Partner", roleViewer: "Nur Ansicht",
    permissions: "Berechtigungen", permissionsSub: "Die Zugriffsebene bestimmt, welche Aktionen im System möglich sind.",
    readOnlyNotice: "Nur-Lese-Modus — Änderungen erfordern die Rolle HR Business Partner.",
    notifications: "Benachrichtigungen", notificationsEmpty: "Keine neuen Benachrichtigungen", notifKbNeedsUpdate: "Dokument benötigt Aktualisierung", markAllRead: "Alle als gelesen markieren",
  },
  en: {
    app: "Labor-law change monitoring", nav: { feed: "Legal changes", kb: "Knowledge base", sources: "Monitored sources", settings: "Settings" },
    greet: "Good morning", greetSub: "{n} new legal changes detected for review",
    kpi: { new: "New changes", pending: "Pending rollout", tracked: "Tracked acts", updated: "Implemented this month" },
    recent: "Recent changes", all: "View all",
    area: { leave: "Leave", pay: "Pay & compensation", safety: "Health & safety", contracts: "Employment contracts", social: "Social insurance", other: "Other" },
    st: { new: "New", progress: "In review", waiting: "Waiting", urgent: "Urgent", done: "Implemented" },
    tabs: { all: "All", new: "New", urgent: "Urgent", done: "Implemented" },
    search: "Search legal act, change or document…", filterArea: "Legal area", allAreas: "All areas", clearFilters: "Clear filters", exportCsv: "Export CSV", exportPdf: "Export PDF", selectAll: "Select all", clearSelection: "Clear selection", selectedCount: "{n} selected", bulkMarkReviewed: "Mark reviewed",
    source: "Source", published: "Published", effective: "Effective from", affected: "Affected documents",
    markReviewed: "Mark reviewed", updateDoc: "Mark implemented", detailEmpty: "Select a change to see details",
    kbTitle: "Knowledge base", kbSub: "HR policies, procedures and templates", needsUpdate: "Needs update",
    kbAll: "All", kbFavorites: "Favorites", addFavorite: "Add to favorites", removeFavorite: "Remove from favorites", kbNoFavorites: "No favorite documents", kbNoFavoritesSub: "Star a document to find it faster.",
    sortBy: "Sort", sortTitle: "Title (A–Z)", sortUpdated: "Last updated", sortNeedsUpdate: "Needs update",
    versionHistory: "Version history", hideVersionHistory: "Hide version history", version: "Version", currentVersion: "Current",
    updated: "Last updated", relatedChanges: "Related legal changes", kbEmpty: "Select a document to see its content",
    discussion: "Discussion", commentPlaceholder: "Add a comment or question about this document…", postComment: "Post comment", noComments: "No comments yet — start the discussion.", commentsCount: "{n} comments",
    attachments: "Attachments", noAttachments: "No attachments.", addAttachment: "Add attachment", uploadedBy: "Uploaded by",
    sourcesTitle: "Monitored sources", sourcesSub: "Legal acts from ISAP (isap.sejm.gov.pl) — always the consolidated text — scanned automatically for changes",
    lastChecked: "Last checked", changesFound: "Changes found", monitoring: "Monitoring",
    checkNow: "Check now", scanning: "Scanning…", scanDone: "Scan complete",
    periodLabel: "Period", periodAll: "All", periodCustom: "Custom range", periodFrom: "From", periodTo: "To", scanPeriod: "Scan period",
    periodQuarter: "Last quarter", period6m: "Last 6 months", periodYear: "Last year",
    periodPrevYear: "Previous year", periodCurYear: "Current year",
    history: "History", hideHistory: "Hide history", evScan: "Scan completed — no changes", evDetected: "Change detected", evPaused: "Monitoring paused", evResumed: "Monitoring resumed",
    feedEmptyTitle: "No changes in this category", feedEmptySub: "Once the system detects a matching legal change, it will appear here.",
    kbNoResults: "No results", kbNoResultsSub: "No documents matched your search.",
    kbEmptyAll: "No documents", kbEmptyAllSub: "The knowledge base is empty — add the first document.",
    login: { title: "Sign in", subtitle: "HR BP support system", email: "Email address", password: "Password", remember: "Remember me", submit: "Sign in", forgot: "Forgot password?", error: "Invalid email or password.", sso: "Sign in with company SSO" },
    settings: { title: "Settings", profile: "Profile", account: "Account", preferences: "Preferences", role: "Role", dept: "Department", language: "Interface language", darkMode: "Dark mode", signOut: "Sign out", saved: "Changes saved" },
    roleHrbp: "HR Business Partner", roleViewer: "View only",
    permissions: "Permissions", permissionsSub: "Access level determines which actions are available in the system.",
    readOnlyNotice: "Read-only mode — changes require the HR Business Partner role.",
    notifications: "Notifications", notificationsEmpty: "No new notifications", notifKbNeedsUpdate: "Document needs update", markAllRead: "Mark all as read",
  },
};

// Real legal changes are no longer hand-written here — they're built at runtime
// from actual Sejm/ELI scan results (see isapIntegration.js buildChangesFromHistory),
// fed by /api/scan-all + /api/state. This used to be 6 fabricated demo entries with
// invented Dz.U. positions and summaries; removed because they read as real legal
// facts but weren't.

// `keyword` maps a source to the real Sejm/ELI API taxonomy term (see /api/_lib.js) —
// verified live against api.sejm.gov.pl before wiring in. PIP has no ELI equivalent
// (it's guidance, not a Dziennik Ustaw act), so it has no keyword and stays manual.
// `area` is our own HR-topic categorization of the source, not a legal fact.
export const HRBP_SOURCES = [
  { id: 1, name: "Kodeks pracy — tekst ujednolicony", type: "Ustawa", url: "https://isap.sejm.gov.pl", keyword: "kodeks pracy", area: "contracts", lastChecked: null, found: 0, active: true },
  { id: 2, name: "Ustawa o PPK — tekst ujednolicony", type: "Ustawa", url: "https://isap.sejm.gov.pl", keyword: "pracownicze plany kapitałowe", area: "pay", lastChecked: null, found: 0, active: true },
  { id: 3, name: "Rozporządzenia MRPiPS ws. BHP", type: "Rozporządzenie", url: "https://isap.sejm.gov.pl", keyword: "BHP", area: "safety", lastChecked: null, found: 0, active: true },
  { id: 4, name: "Ustawa o zatrudnianiu cudzoziemców", type: "Ustawa", url: "https://isap.sejm.gov.pl", keyword: "cudzoziemcy", area: "contracts", lastChecked: null, found: 0, active: true },
  { id: 5, name: "Ustawa o związkach zawodowych", type: "Ustawa", url: "https://isap.sejm.gov.pl", keyword: "związki zawodowe", area: "other", lastChecked: null, found: 0, active: true },
  { id: 6, name: "Państwowa Inspekcja Pracy — wytyczne", type: "Wytyczne", url: "https://www.pip.gov.pl", keyword: null, area: "safety", lastChecked: null, found: 0, active: false },
];

// No seed history — real per-source history comes back from /api/state once a
// scan (cron or manual) has actually run. Empty until then, not invented.
export const HRBP_SOURCE_HISTORY = {};

// No real HR policy documents exist yet — this used to be 6 fabricated
// policies (invented leave/pay rules, a fake plant location, fake authors and
// comments). Removed: presenting invented company policy as real destroys
// trust. Add real documents here once they exist.
export const HRBP_KB = [];
export const HRBP_KB_COMMENTS = {};
export const HRBP_KB_ATTACHMENTS = {};
export const HRBP_KB_VERSIONS = {};
export const HRBP_AREA_TONE = { leave: "brand", pay: "blue", safety: "amber", contracts: "neutral", social: "green", other: "neutral" };
export const HRBP_STATUS_MAP = { new: "new", progress: "progress", waiting: "waiting", urgent: "urgent", done: "done" };
