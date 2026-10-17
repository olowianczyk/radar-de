// Features — "Funkcje aplikacji": a one-page overview of everything the app can
// do, written for business owners and new users. Where Help (Instrukcja)
// explains HOW things work in detail (scan pipeline, statuses, phrase tips),
// this page answers WHAT is available and WHERE to find it — one card per
// screen, each with a button that opens that screen.
//
// The texts are static and live here (like Help.jsx / CaseLaw.jsx), in the
// same three languages as the rest of the UI. They describe features that
// exist in the code today; when a screen gains or loses a feature, update its
// card here too (there is no automatic link between the two).
//
// ponytail: plain hand-written lists, no generated feature registry — the
// page changes rarely and a registry would be one more thing to keep in sync.
import React from "react";
import { Card, Icon, Button } from "../components/index.js";

const FEATURES = {
  pl: {
    title: "Funkcje aplikacji",
    intro: "Radar Legislacyjny codziennie sprawdza publiczne rejestry prawa i zbiera w jednym miejscu to, co dotyczy Twojego działu: nowe akty, projekty ustaw w Sejmie, prawo UE i orzeczenia sądów. Poniżej znajdziesz wszystkie funkcje, ekran po ekranie. Szczegóły działania opisuje Instrukcja.",
    open: "Otwórz",
    toHelp: "Szczegóły w Instrukcji",
    modules: [
      {
        screen: "feed", icon: "scale", title: "Zmiany w przepisach",
        lead: "Feed wszystkiego, co wykryły źródła działu: akty z Dziennika Ustaw i Monitora Polskiego, projekty ustaw z Sejmu, akty i projekty Komisji UE z EUR-Lex oraz orzeczenia z SAOS. Najnowsze na górze.",
        items: [
          "Liczniki na górze: nowe zmiany, do wdrożenia, aktywne źródła, wdrożone w tym miesiącu.",
          "Zakładki Wszystkie / Nowe / Pilne / Wdrożone oraz filtry: wyszukiwanie po tekście, obszar prawa, rodzaj wpisu (akt, projekt ustawy, orzeczenie) i okres.",
          "Panel szczegółów: daty, typ aktu, status aktu wg ISAP, etap projektu i numer druku, numer CELEX dokumentu UE, link do ISAP, Sejmu, EUR-Lex albo SAOS.",
          "„Jak to znaleziono”: które źródło i jakie zapytanie znalazło wpis, z linkiem do surowej odpowiedzi API — każdy wpis da się sprawdzić samodzielnie.",
          "Status przeglądu: Nowe, W przeglądzie, Pilne, Wdrożone. Wspólny dla całego działu.",
          "„Zapisz w bazie wiedzy” w szczegółach wpisu: zmiana z aktem, datą, opisem i linkiem trafia do bazy działu.",
          "Zaznaczanie wielu wpisów, akcja zbiorcza „Rozpocznij przegląd”, eksport CSV i PDF, wydruk pojedynczej zmiany.",
        ],
      },
      {
        screen: "sources", icon: "radar", title: "Monitorowane źródła",
        lead: "Pełna lista tego, co jest skanowane w dziale, i na jakiej podstawie. Tu decydujesz o zakresie monitoringu.",
        items: [
          "Karta „Co jest monitorowane”: ile źródeł działa automatycznie, które wymagają przeglądu ręcznego i czego aplikacja nie sprawdza.",
          "Filtry: rejestr (Dziennik Ustaw, Monitor Polski, Sejm, EUR-Lex, SAOS), źródła wyłączone, źródła z błędem; wyszukiwarka źródeł.",
          "Przy każdym źródle: zakres przeszukiwania, dokładne zapytanie z linkiem, data ostatniego sprawdzenia, liczba wykrytych zmian i kontrola, czy słowo kluczowe istnieje w słowniku Sejmu.",
          "Przełącznik włącza i wyłącza źródło (także w skanie nocnym) bez utraty historii.",
          "„Nowe źródło”: własne źródło w Dzienniku Ustaw, Monitorze Polskim, Sejmie (projekty ustaw), EUR-Lex (prawo UE) albo SAOS — po słowie kluczowym, fragmencie tytułu, powołanym akcie lub frazie. Własne źródła można usunąć.",
          "„Sprawdź teraz” z opcjonalnym zakresem dat — ręczny skan, np. od 1 stycznia.",
          "Lista źródeł ręcznych (TSUE, regulatorzy, listy sankcyjne, projekty w RCL) z zalecaną częstotliwością przeglądu.",
        ],
      },
      {
        screen: "caselaw", icon: "gavel", title: "Orzecznictwo",
        lead: "Wyszukiwarka orzeczeń sądów w SAOS na żądanie — do pytań typu „co sądy mówią o mobbingu?” albo „znajdź sprawę I PK 12/15”.",
        items: [
          "Kryteria: fraza w treści, powołany akt, sygnatura, sąd, rodzaj orzeczenia, zakres dat. Wyniki od najnowszych, ze stronicowaniem.",
          "Podpowiedzi fraz: Twoje ostatnie wyszukiwania, słowa kluczowe z wyników na ekranie i terminy ze źródeł działu.",
          "Kliknięcie słowa kluczowego przy orzeczeniu od razu wyszukuje po nim.",
          "Przy każdym sądzie informacja, do kiedy SAOS ma jego orzeczenia, i link do portalu tego sądu.",
          "Wyniki są zapisywane na serwerze: to samo zapytanie wraca od razu, także gdy SAOS nie odpowiada.",
          "„Zapisz w bazie wiedzy”: orzeczenie z sygnaturą, sądem, datą i linkiem trafia do bazy działu.",
        ],
      },
      {
        screen: "kb", icon: "book-open", title: "Baza wiedzy",
        lead: "Wspólny notatnik działu: polityki, procedury, notatki o zmianach w toku i zapisane orzeczenia.",
        items: [
          "Trzy sposoby dodania: przycisk „Dodaj dokument” tutaj, „Zapisz w bazie wiedzy” przy zmianie w przepisach i przy orzeczeniu. Adresy http(s) w treści są klikalne.",
          "Komentarze pod dokumentem — dyskusja zespołu przy konkretnym temacie.",
          "Wyszukiwanie, sortowanie (tytuł, najnowsze) i ulubione (gwiazdka zapamiętana w Twojej przeglądarce).",
          "Usuwanie dokumentu — znika razem z komentarzami dla całego działu, bez możliwości cofnięcia.",
          "Baza jest otwarta dla każdego, kto ma link — nie wpisuj informacji poufnych.",
        ],
      },
      {
        screen: "help", icon: "help-circle", title: "Instrukcja",
        lead: "Szczegółowy opis działania aplikacji dla osób, które chcą wiedzieć dokładnie, skąd bierze się każdy wpis.",
        items: [
          "Krok po kroku: od harmonogramu skanu do karty w feedzie.",
          "Dwa rodzaje statusu (przeglądu i aktu wg ISAP) i czym się różnią.",
          "Pełna lista źródeł działu, generowana z konfiguracji skanera, oraz zasady doboru aktów i słów kluczowych.",
          "Wyszukiwarka słownika słów kluczowych Sejmu.",
          "Poradniki: dodawanie własnych źródeł i śledzenie projektów ustaw w Sejmie. FAQ i wersja do druku.",
        ],
      },
      {
        screen: "settings", icon: "settings", title: "Na każdym ekranie i w Ustawieniach", go: "Ustawienia",
        lead: "Elementy wspólne: pasek górny, przełącznik działu, wygląd i podpowiedzi.",
        items: [
          "Przełącznik działu (HR, Compliance, Dział prawny): każdy dział ma własne źródła, feed i bazę wiedzy. Adres strony zawiera dział, więc link można wysłać współpracownikowi.",
          "Dzwonek powiadomień (na komputerze): nowe i pilne zmiany; przeczytane zapamiętuje przeglądarka.",
          "Data ostatniego sprawdzenia i przycisk odświeżania, który uruchamia „Sprawdź teraz”.",
          "Język PL / DE / EN, motyw (Radar, Jasny, Ciemny neutralny, Jak w systemie), kolor akcentu i tryb ciemny — w pasku górnym i w Ustawieniach.",
          "Ikonki ⓘ przy polach i etykietach: krótkie wyjaśnienie po najechaniu, wejściu klawiszem Tab albo stuknięciu.",
          "Logo w pasku bocznym prowadzi do strony głównej. Na telefonie nawigacja jest na dolnym pasku.",
        ],
      },
    ],
    autoTitle: "Co dzieje się automatycznie",
    auto: [
      "Codziennie o 04:00 UTC (06:00 latem, 05:00 zimą czasu polskiego) skan wszystkich aktywnych źródeł we wszystkich działach. Przeglądarka nie musi być otwarta.",
      "Ten sam akt znaleziony przez kilka źródeł albo w kilku skanach pojawia się w feedzie raz.",
      "Każdy nowy etap projektu ustawy w Sejmie (wpłynięcie, czytanie, uchwalenie…) to nowy wpis do przeglądu.",
      "Orzeczenia: okno skanu cofnięte o 180 dni, bo SAOS publikuje z opóźnieniem.",
      "Prawo UE: okno skanu cofnięte o 180 dni, bo polskie tytuły w EUR-Lex pojawiają się z opóźnieniem.",
      "Po skanie dział dostaje jeden mail z nowościami: akty, nowe etapy projektów ustaw, prawo UE, orzeczenia (gdy administrator skonfiguruje SMTP, patrz Ustawienia).",
      "Wyniki skanów, statusy, konfiguracja źródeł i baza wiedzy są zapisywane na serwerze i wspólne dla działu.",
    ],
    flowTitle: "Typowy tydzień pracy",
    flow: [
      "Otwórz „Zmiany w przepisach”, zakładka „Nowe”.",
      "Otwórz wpis, sprawdź „Jak to znaleziono” i link do źródła.",
      "Ustaw status: W przeglądzie, Pilne albo Wdrożone. Ustalenia zapisz w Bazie wiedzy.",
      "Co jakiś czas przejrzyj źródła ręczne z podaną częstotliwością i sprawdź źródła z błędem.",
      "Na raport: wybierz okres i wyeksportuj CSV albo PDF.",
    ],
    limitsTitle: "Czego aplikacja nie robi",
    limits: [
      "Nie czyta treści aktów i nie ocenia, czy zmiana jest istotna dla firmy — to zadanie osoby, która przegląda wpis.",
      "Nie śledzi późniejszych losów wykrytego aktu: status aktu to migawka z dnia wykrycia.",
      "Nie skanuje TSUE, decyzji regulatorów, list sankcyjnych ani projektów w RCL i w Senacie — są na liście źródeł ręcznych.",
      "Nie ma logowania ani kont użytkowników.",
      "Nie przechowuje załączników ani historii wersji dokumentów w bazie wiedzy.",
    ],
  },
  en: {
    title: "App features",
    intro: "Radar Legislacyjny checks public law registers every day and collects in one place what matters to your department: new acts, bills in the Sejm, EU law and court judgments. Below are all features, screen by screen. The User guide explains how they work in detail.",
    open: "Open",
    toHelp: "Details in the User guide",
    modules: [
      {
        screen: "feed", icon: "scale", title: "Legal changes",
        lead: "A feed of everything the department's sources detected: acts from the Journal of Laws and Monitor Polski, bills from the Sejm, EU acts and Commission proposals from EUR-Lex, and judgments from SAOS. Newest first.",
        items: [
          "Counters at the top: new changes, to implement, active sources, implemented this month.",
          "Tabs All / New / Urgent / Implemented plus filters: text search, area of law, entry type (act, bill, judgment) and period.",
          "Detail panel: dates, act type, act status per ISAP, bill stage and print number, the CELEX number of EU documents, link to ISAP, the Sejm, EUR-Lex or SAOS.",
          "“How it was found”: which source and which query found the entry, with a link to the raw API response — every entry can be checked independently.",
          "Review status: New, In review, Urgent, Implemented. Shared by the whole department.",
          "“Save to knowledge base” in the entry's details: the change with act, date, description and link goes into the department's base.",
          "Selecting many entries, bulk “Start review”, CSV and PDF export, printing a single change.",
        ],
      },
      {
        screen: "sources", icon: "radar", title: "Monitored sources",
        lead: "The full list of what is scanned for the department and on what basis. This is where you decide the monitoring scope.",
        items: [
          "“What is monitored” card: how many sources run automatically, which need manual review and what the app does not check.",
          "Filters: register (Journal of Laws, Monitor Polski, Sejm, EUR-Lex, SAOS), switched-off sources, sources with errors; source search.",
          "For every source: search scope, the exact query with a link, last check date, number of changes found and a check that the keyword exists in the Sejm thesaurus.",
          "The switch turns a source on or off (also for the nightly scan) without losing its history.",
          "“New source”: your own source in the Journal of Laws, Monitor Polski, the Sejm (bills), EUR-Lex (EU law) or SAOS — by keyword, title fragment, cited act or phrase. Your own sources can be deleted.",
          "“Check now” with an optional date range — a manual scan, e.g. from 1 January.",
          "List of manual sources (CJEU, regulators, sanctions lists, RCL drafts) with the recommended review frequency.",
        ],
      },
      {
        screen: "caselaw", icon: "gavel", title: "Case law",
        lead: "On-demand search over court judgments in SAOS — for questions like “what do courts say about mobbing?” or “find case I PK 12/15”.",
        items: [
          "Criteria: phrase in the text, cited act, case number, court, judgment type, date range. Newest first, with paging.",
          "Phrase suggestions: your recent searches, keywords of the judgments on screen and terms from the department's sources.",
          "Clicking a judgment's keyword searches for it straight away.",
          "For every court: how far SAOS has its judgments, and a link to that court's portal.",
          "Results are saved on the server: the same query returns instantly, even when SAOS is not responding.",
          "“Save to knowledge base”: the judgment with case number, court, date and link goes into the department's base.",
        ],
      },
      {
        screen: "kb", icon: "book-open", title: "Knowledge base",
        lead: "The department's shared notebook: policies, procedures, notes on pending changes and saved judgments.",
        items: [
          "Three ways to add: the “Add document” button here, and “Save to knowledge base” on a legal change and on a judgment. http(s) addresses in the body are clickable.",
          "Comments under a document — team discussion on a specific topic.",
          "Search, sorting (title, newest) and favourites (a star remembered in your browser).",
          "Deleting a document — it disappears with its comments for the whole department and cannot be undone.",
          "The base is open to anyone with the link — do not enter confidential information.",
        ],
      },
      {
        screen: "help", icon: "help-circle", title: "User guide",
        lead: "A detailed description of how the app works, for anyone who wants to know exactly where each entry comes from.",
        items: [
          "Step by step: from the scan schedule to the card in the feed.",
          "The two kinds of status (review and act status per ISAP) and how they differ.",
          "The department's full source list, generated from the scanner configuration, and how acts and keywords were chosen.",
          "Search over the Sejm keyword thesaurus.",
          "Guides: adding your own sources and following bills in the Sejm. FAQ and a printable version.",
        ],
      },
      {
        screen: "settings", icon: "settings", title: "On every screen and in Settings", go: "Settings",
        lead: "Shared elements: the top bar, the department switch, appearance and hints.",
        items: [
          "Department switch (HR, Compliance, Legal): each department has its own sources, feed and knowledge base. The page address contains the department, so you can send a colleague a link.",
          "Notification bell (on desktop): new and urgent changes; your browser remembers which you have read.",
          "Last check date and a refresh button that runs “Check now”.",
          "Language PL / DE / EN, theme (Radar, Light, Neutral dark, Follow system), accent colour and dark mode — in the top bar and in Settings.",
          "ⓘ icons next to fields and labels: a short explanation on hover, Tab focus or tap.",
          "The logo in the sidebar leads to the home page. On a phone, navigation is in the bottom bar.",
        ],
      },
    ],
    autoTitle: "What happens automatically",
    auto: [
      "Every day at 04:00 UTC (06:00 in summer, 05:00 in winter, Polish time) all active sources of all departments are scanned. No browser needs to be open.",
      "The same act found by several sources or in several scans appears in the feed once.",
      "Every new stage of a bill in the Sejm (filed, reading, passed…) is a new entry to review.",
      "Judgments: the scan window is moved back 180 days because SAOS publishes with a delay.",
      "EU law: the scan window is moved back 180 days because Polish titles appear in EUR-Lex with a delay.",
      "After the scan the department gets one e-mail with what is new: acts, new bill stages, EU law, judgments (once an administrator sets up SMTP, see Settings).",
      "Scan results, statuses, source configuration and the knowledge base are saved on the server and shared by the department.",
    ],
    flowTitle: "A typical week",
    flow: [
      "Open “Legal changes”, tab “New”.",
      "Open an entry, check “How it was found” and the link to the source.",
      "Set the status: In review, Urgent or Implemented. Write your findings in the Knowledge base.",
      "From time to time review the manual sources at their stated frequency and check sources with errors.",
      "For a report: pick the period and export CSV or PDF.",
    ],
    limitsTitle: "What the app does not do",
    limits: [
      "It does not read the text of acts or judge whether a change matters to the company — that is the reviewer's job.",
      "It does not follow what later happens to a detected act: the act status is a snapshot from the day it was detected.",
      "It does not scan the CJEU, regulators' decisions, sanctions lists or drafts at RCL and in the Senate — they are on the manual source list.",
      "There is no login or user accounts.",
      "It stores no attachments and no version history of knowledge base documents.",
    ],
  },
  de: {
    title: "Funktionen der App",
    intro: "Radar Legislacyjny prüft täglich die öffentlichen Rechtsregister und sammelt an einem Ort, was Ihre Abteilung betrifft: neue Rechtsakte, Gesetzentwürfe im Sejm, EU-Recht und Gerichtsurteile. Unten finden Sie alle Funktionen, Bildschirm für Bildschirm. Die Anleitung erklärt die Details.",
    open: "Öffnen",
    toHelp: "Details in der Anleitung",
    modules: [
      {
        screen: "feed", icon: "scale", title: "Rechtsänderungen",
        lead: "Ein Feed mit allem, was die Quellen der Abteilung gefunden haben: Akte aus dem Gesetzblatt und dem Monitor Polski, Gesetzentwürfe aus dem Sejm, EU-Rechtsakte und Kommissionsvorschläge aus EUR-Lex sowie Urteile aus SAOS. Neueste zuerst.",
        items: [
          "Zähler oben: neue Änderungen, umzusetzen, aktive Quellen, in diesem Monat umgesetzt.",
          "Reiter Alle / Neu / Dringend / Umgesetzt sowie Filter: Textsuche, Rechtsgebiet, Eintragsart (Akt, Gesetzentwurf, Urteil) und Zeitraum.",
          "Detailbereich: Daten, Aktart, Status des Akts laut ISAP, Phase des Entwurfs und Drucksachennummer, CELEX-Nummer von EU-Dokumenten, Link zu ISAP, Sejm, EUR-Lex oder SAOS.",
          "„So wurde es gefunden“: welche Quelle und welche Abfrage den Eintrag gefunden hat, mit Link zur Roh-Antwort der API — jeder Eintrag ist selbst überprüfbar.",
          "Prüfstatus: Neu, In Prüfung, Dringend, Umgesetzt. Für die ganze Abteilung gemeinsam.",
          "„In der Wissensbasis speichern“ in den Details: die Änderung mit Akt, Datum, Beschreibung und Link landet in der Wissensbasis der Abteilung.",
          "Mehrfachauswahl, Sammelaktion „Prüfung starten“, Export als CSV und PDF, Druck einer einzelnen Änderung.",
        ],
      },
      {
        screen: "sources", icon: "radar", title: "Überwachte Quellen",
        lead: "Die vollständige Liste dessen, was für die Abteilung gescannt wird, und auf welcher Grundlage. Hier legen Sie den Umfang der Überwachung fest.",
        items: [
          "Karte „Was überwacht wird“: wie viele Quellen automatisch laufen, welche manuell geprüft werden müssen und was die App nicht prüft.",
          "Filter: Register (Gesetzblatt, Monitor Polski, Sejm, EUR-Lex, SAOS), ausgeschaltete Quellen, Quellen mit Fehler; Quellensuche.",
          "Bei jeder Quelle: Suchumfang, die genaue Abfrage mit Link, Datum der letzten Prüfung, Zahl der gefundenen Änderungen und eine Prüfung, ob das Schlagwort im Sejm-Thesaurus existiert.",
          "Der Schalter schaltet eine Quelle ein oder aus (auch für den nächtlichen Scan), ohne ihren Verlauf zu verlieren.",
          "„Neue Quelle“: eigene Quelle im Gesetzblatt, Monitor Polski, Sejm (Gesetzentwürfe), EUR-Lex (EU-Recht) oder SAOS — nach Schlagwort, Titelfragment, zitiertem Akt oder Phrase. Eigene Quellen können gelöscht werden.",
          "„Jetzt prüfen“ mit optionalem Datumsbereich — ein manueller Scan, z. B. ab dem 1. Januar.",
          "Liste der manuellen Quellen (EuGH, Aufsichtsbehörden, Sanktionslisten, RCL-Entwürfe) mit empfohlener Prüfhäufigkeit.",
        ],
      },
      {
        screen: "caselaw", icon: "gavel", title: "Rechtsprechung",
        lead: "Suche nach Gerichtsurteilen in SAOS auf Abruf — für Fragen wie „Was sagen Gerichte zu Mobbing?“ oder „Finde das Verfahren I PK 12/15“.",
        items: [
          "Kriterien: Phrase im Text, zitierter Akt, Aktenzeichen, Gericht, Art der Entscheidung, Datumsbereich. Neueste zuerst, mit Seiten.",
          "Phrasenvorschläge: Ihre letzten Suchen, Schlagwörter der angezeigten Urteile und Begriffe aus den Quellen der Abteilung.",
          "Ein Klick auf ein Schlagwort eines Urteils sucht sofort danach.",
          "Bei jedem Gericht: bis wann SAOS seine Urteile hat, und ein Link zum Portal des Gerichts.",
          "Ergebnisse werden auf dem Server gespeichert: dieselbe Abfrage kommt sofort zurück, auch wenn SAOS nicht antwortet.",
          "„In der Wissensbasis speichern“: das Urteil mit Aktenzeichen, Gericht, Datum und Link landet in der Wissensbasis der Abteilung.",
        ],
      },
      {
        screen: "kb", icon: "book-open", title: "Wissensbasis",
        lead: "Das gemeinsame Notizbuch der Abteilung: Richtlinien, Verfahren, Notizen zu laufenden Änderungen und gespeicherte Urteile.",
        items: [
          "Drei Wege zum Hinzufügen: die Schaltfläche „Dokument hinzufügen“ hier sowie „In der Wissensbasis speichern“ bei einer Rechtsänderung und bei einem Urteil. http(s)-Adressen im Inhalt sind anklickbar.",
          "Kommentare unter einem Dokument — Diskussion im Team zu einem konkreten Thema.",
          "Suche, Sortierung (Titel, neueste) und Favoriten (Stern, im eigenen Browser gespeichert).",
          "Dokument löschen — es verschwindet samt Kommentaren für die ganze Abteilung und kann nicht wiederhergestellt werden.",
          "Die Wissensbasis ist für alle mit dem Link offen — keine vertraulichen Informationen eintragen.",
        ],
      },
      {
        screen: "help", icon: "help-circle", title: "Anleitung",
        lead: "Eine ausführliche Beschreibung der Funktionsweise für alle, die genau wissen wollen, woher jeder Eintrag kommt.",
        items: [
          "Schritt für Schritt: vom Scan-Zeitplan bis zur Karte im Feed.",
          "Die zwei Arten von Status (Prüfstatus und Status des Akts laut ISAP) und ihr Unterschied.",
          "Die vollständige Quellenliste der Abteilung, erzeugt aus der Scanner-Konfiguration, und wie Akte und Schlagwörter ausgewählt wurden.",
          "Suche im Sejm-Schlagwort-Thesaurus.",
          "Leitfäden: eigene Quellen hinzufügen und Gesetzentwürfe im Sejm verfolgen. FAQ und Druckversion.",
        ],
      },
      {
        screen: "settings", icon: "settings", title: "Auf jedem Bildschirm und in den Einstellungen", go: "Einstellungen",
        lead: "Gemeinsame Elemente: obere Leiste, Abteilungswechsel, Darstellung und Hinweise.",
        items: [
          "Abteilungswechsel (HR, Compliance, Rechtsabteilung): jede Abteilung hat eigene Quellen, einen eigenen Feed und eine eigene Wissensbasis. Die Adresse enthält die Abteilung, sodass Sie Kollegen einen Link schicken können.",
          "Benachrichtigungsglocke (am Computer): neue und dringende Änderungen; gelesene merkt sich der Browser.",
          "Datum der letzten Prüfung und eine Aktualisieren-Schaltfläche, die „Jetzt prüfen“ startet.",
          "Sprache PL / DE / EN, Design (Radar, Hell, Dunkel neutral, Wie System), Akzentfarbe und Dunkelmodus — in der oberen Leiste und in den Einstellungen.",
          "ⓘ-Symbole neben Feldern und Beschriftungen: eine kurze Erklärung beim Überfahren, Tab-Fokus oder Antippen.",
          "Das Logo in der Seitenleiste führt zur Startseite. Auf dem Handy liegt die Navigation in der unteren Leiste.",
        ],
      },
    ],
    autoTitle: "Was automatisch passiert",
    auto: [
      "Täglich um 04:00 UTC (06:00 im Sommer, 05:00 im Winter, polnische Zeit) werden alle aktiven Quellen aller Abteilungen gescannt. Kein Browser muss geöffnet sein.",
      "Derselbe Akt, gefunden von mehreren Quellen oder in mehreren Scans, erscheint im Feed nur einmal.",
      "Jede neue Phase eines Gesetzentwurfs im Sejm (eingebracht, Lesung, beschlossen…) ist ein neuer Eintrag zur Prüfung.",
      "Urteile: das Scan-Fenster wird um 180 Tage zurückgesetzt, weil SAOS verzögert veröffentlicht.",
      "EU-Recht: das Scan-Fenster wird um 180 Tage zurückgesetzt, weil polnische Titel in EUR-Lex verzögert erscheinen.",
      "Nach dem Scan erhält die Abteilung eine E-Mail mit den Neuigkeiten: Akte, neue Phasen von Gesetzentwürfen, EU-Recht, Urteile (sobald ein Administrator SMTP einrichtet, siehe Einstellungen).",
      "Scan-Ergebnisse, Status, Quellenkonfiguration und Wissensbasis werden auf dem Server gespeichert und von der Abteilung geteilt.",
    ],
    flowTitle: "Eine typische Arbeitswoche",
    flow: [
      "„Rechtsänderungen“ öffnen, Reiter „Neu“.",
      "Einen Eintrag öffnen, „So wurde es gefunden“ und den Link zur Quelle prüfen.",
      "Status setzen: In Prüfung, Dringend oder Umgesetzt. Ergebnisse in der Wissensbasis festhalten.",
      "Von Zeit zu Zeit die manuellen Quellen in der angegebenen Häufigkeit prüfen und Quellen mit Fehler ansehen.",
      "Für einen Bericht: Zeitraum wählen und als CSV oder PDF exportieren.",
    ],
    limitsTitle: "Was die App nicht tut",
    limits: [
      "Sie liest nicht den Text der Akte und beurteilt nicht, ob eine Änderung für das Unternehmen wichtig ist — das ist Aufgabe der prüfenden Person.",
      "Sie verfolgt nicht, was später mit einem gefundenen Akt geschieht: der Status ist eine Momentaufnahme vom Tag der Erkennung.",
      "Sie scannt keinen EuGH, keine Behördenentscheidungen, keine Sanktionslisten und keine Entwürfe im RCL und im Senat — diese stehen auf der Liste der manuellen Quellen.",
      "Es gibt keine Anmeldung und keine Benutzerkonten.",
      "Sie speichert keine Anhänge und keinen Versionsverlauf von Dokumenten der Wissensbasis.",
    ],
  },
};

// Section heading with an icon in the brand colour — same look as Help's H2.
function H2({ icon, children }) {
  return (
    <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--text-heading)" }}>
      <Icon name={icon} size={20} style={{ color: "var(--brand)" }} />{children}
    </h2>
  );
}

// Plain bulleted list used by every section.
function List({ items, ordered }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag style={{ margin: "12px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((line) => <li key={line} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{line}</li>)}
    </Tag>
  );
}

// m.go = shorter button label where the card title is not a screen name.
// setActive (from App.jsx) switches the screen; it is what the "Open" buttons
// call, so each card leads straight to the screen it describes.
export function Features({ lang, setActive }) {
  const f = FEATURES[lang] || FEATURES.pl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", margin: 0 }}>{f.title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--text-body)", fontSize: 14, lineHeight: 1.6, maxWidth: 820 }}>{f.intro}</p>
      </div>

      {/* One card per screen; auto-fit gives 2 columns on desktop, 1 on phones. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 18, alignItems: "stretch" }}>
        {f.modules.map((m) => (
          <Card key={m.screen} padding="lg">
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <H2 icon={m.icon}>{m.title}</H2>
              <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-heading)", fontWeight: 500 }}>{m.lead}</p>
              <List items={m.items} />
              <div style={{ flex: 1 }} />
              <div style={{ marginTop: 16 }}>
                <Button variant="secondary" size="sm" iconRight={<Icon name="arrow-right" size={14} />} onClick={() => setActive(m.screen)}>{f.open}: {m.go || m.title}</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 18, alignItems: "start" }}>
        <Card padding="lg"><H2 icon="clock">{f.autoTitle}</H2><List items={f.auto} /></Card>
        <Card padding="lg"><H2 icon="list-checks">{f.flowTitle}</H2><List items={f.flow} ordered /></Card>
      </div>

      <Card padding="lg">
        <H2 icon="circle-slash">{f.limitsTitle}</H2>
        <List items={f.limits} />
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="help-circle" size={14} />} onClick={() => setActive("help")}>{f.toHelp}</Button>
        </div>
      </Card>
    </div>
  );
}
