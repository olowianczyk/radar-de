// Country profile of THIS build. The same code serves two independent
// instances (PL and DE, no shared data); the instance is chosen at BUILD time:
//   npm run build        -> PL (default, unchanged behaviour of the original app)
//   npm run build:de     -> DE (VITE_COUNTRY=de)
// Everything that used to be hard-wired to Poland and is not a translation
// (default language, number/date locale, public registry names and links)
// lives here, so a screen never needs to know which country it runs in.
// Translations themselves stay in data.js (HRBP_I18N); the DE instance only
// changes the DEFAULT language, the user can still switch PL/DE/EN in Settings.

const ID = (import.meta.env && import.meta.env.VITE_COUNTRY) === "de" ? "de" : "pl";

const PROFILES = {
  pl: {
    id: "pl",
    defaultLang: "pl",
    // Locale for dates/numbers when the UI language is the country language.
    locale: "pl-PL",
    registers: {
      ELI: { name: "ISAP", url: "https://isap.sejm.gov.pl" },
      SEJM: { name: "Sejm", url: "https://www.sejm.gov.pl" },
      SAOS: { name: "SAOS", url: "https://www.saos.org.pl" },
      RCL: { name: "RCL", url: "https://legislacja.gov.pl" },
      EURLEX: { name: "EUR-Lex", url: "https://eur-lex.europa.eu" },
    },
  },
  de: {
    id: "de",
    defaultLang: "de",
    locale: "de-DE",
    // DE registers (see docs/KONCEPCJA-DE.md, section 3). Registers not listed
    // here simply do not exist in the DE instance.
    registers: {
      RIP: { name: "Rechtsinformationsportal", url: "https://testphase.rechtsinformationen.bund.de" },
      RIPCASE: { name: "Rechtsinformationsportal", url: "https://testphase.rechtsinformationen.bund.de" },
      DIP: { name: "DIP", url: "https://dip.bundestag.de" },
      REFE: { name: "BMAS/BMJV", url: "https://www.bmas.de" },
      BAGRSS: { name: "BAG", url: "https://www.bundesarbeitsgericht.de" },
      EURLEX: { name: "EUR-Lex", url: "https://eur-lex.europa.eu" },
    },
  },
};

export const COUNTRY = PROFILES[ID];
export const DEFAULT_LANG = COUNTRY.defaultLang;
export const LOCALE = COUNTRY.locale;

// BCP-47 locale for a UI language (dates, numbers). EN uses en-GB (dd/mm/yyyy).
export function localeFor(lang) {
  return lang === "pl" ? "pl-PL" : lang === "de" ? "de-DE" : "en-GB";
}
