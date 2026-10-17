// Settings — interface preferences (language, dark mode), both stored in this
// browser. There is no account and no permission model: the tool is an open
// link by design, so nothing here pretends otherwise.
// The "E-mail notifications" card only SHOWS the daily digest setup: SMTP and
// recipients live in Vercel env vars (api/_mail.js), so nobody with the link
// can redirect the mails. It can send one test mail (rate-limited server-side).
import React from "react";
import { Card, Select, Badge, Icon, Button } from "../components/index.js";
import { tFor, ACCENTS, WORKSPACES, THEMES, THEME_ICON, ACCENT_SWATCH as SWATCH } from "../workspaces.js";
import { sendTestMail } from "../isapIntegration.js";

// Screen-local strings for the notifications card (order: pl, en, de).
const NOTIFY = {
  pl: {
    title: "Powiadomienia e-mail", lead: "Codziennie po porannym skanie dział dostaje jeden mail z tym, co wykryto od poprzedniego: nowe i zmienione akty, nowe etapy projektów ustaw w Sejmie, orzeczenia. Bez nowości mail nie wychodzi.",
    status: "Stan", on: "Włączone", off: "Nieskonfigurowane", smtp: "Serwer SMTP", smtpOk: "ustawiony", smtpMissing: "brak", to: "Odbiorcy", none: "brak",
    queued: "Czeka na najbliższy mail", lastSent: "Ostatnio wysłano", never: "jeszcze nie", lastError: "Ostatni błąd",
    test: "Wyślij testowy mail", testing: "Wysyłam…", testOk: "Wysłano testowy mail.",
    setup: "Konfiguracja (administrator, w Vercel → Settings → Environment Variables): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM oraz NOTIFY_TO (adresy po przecinku) albo NOTIFY_TO_HR / NOTIFY_TO_COMPLIANCE / NOTIFY_TO_LEGAL dla jednego działu. Po zmianie potrzebny redeploy.",
  },
  en: {
    title: "E-mail notifications", lead: "Every day after the morning scan the department gets one e-mail with what was detected since the previous one: new and amended acts, new stages of bills in the Sejm, judgments. Nothing new, no e-mail.",
    status: "Status", on: "On", off: "Not configured", smtp: "SMTP server", smtpOk: "set", smtpMissing: "missing", to: "Recipients", none: "none",
    queued: "Waiting for the next e-mail", lastSent: "Last sent", never: "not yet", lastError: "Last error",
    test: "Send a test e-mail", testing: "Sending…", testOk: "Test e-mail sent.",
    setup: "Setup (administrator, in Vercel → Settings → Environment Variables): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and NOTIFY_TO (comma-separated addresses) or NOTIFY_TO_HR / NOTIFY_TO_COMPLIANCE / NOTIFY_TO_LEGAL for one department. Redeploy after a change.",
  },
  de: {
    title: "E-Mail-Benachrichtigungen", lead: "Jeden Tag nach dem Morgenscan erhält die Abteilung eine E-Mail mit allem, was seit der letzten erkannt wurde: neue und geänderte Akte, neue Stufen von Gesetzentwürfen im Sejm, Urteile. Nichts Neues, keine E-Mail.",
    status: "Status", on: "Aktiv", off: "Nicht eingerichtet", smtp: "SMTP-Server", smtpOk: "eingerichtet", smtpMissing: "fehlt", to: "Empfänger", none: "keine",
    queued: "Wartet auf die nächste E-Mail", lastSent: "Zuletzt gesendet", never: "noch nicht", lastError: "Letzter Fehler",
    test: "Test-E-Mail senden", testing: "Wird gesendet…", testOk: "Test-E-Mail gesendet.",
    setup: "Einrichtung (Administrator, in Vercel → Settings → Environment Variables): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM sowie NOTIFY_TO (Adressen mit Komma) oder NOTIFY_TO_HR / NOTIFY_TO_COMPLIANCE / NOTIFY_TO_LEGAL für eine Abteilung. Danach neu deployen.",
  },
};

// Status of the department's daily digest + a test button. `notify` comes from
// /api/state (null while the backend is down — then the card says so via `off`).
function NotifyCard({ lang, ws, backend, notify, setNotify }) {
  const n = NOTIFY[lang] || NOTIFY.pl;
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null); // { ok, text }
  const configured = !!(notify && notify.smtp && notify.recipients.length);
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(lang === "en" ? "en-GB" : lang) : n.never);
  const test = () => {
    setBusy(true); setMsg(null);
    sendTestMail(ws.id)
      .then((st) => { setNotify(st); setMsg({ ok: true, text: n.testOk }); })
      .catch((e) => setMsg({ ok: false, text: e.message }))
      .finally(() => setBusy(false));
  };
  return (
    <Card padding="lg" header={n.title}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>{n.lead}</p>
      <Row label={n.status}><Badge tone={configured ? "green" : "neutral"}>{configured ? n.on : n.off}</Badge></Row>
      {notify && (
        <>
          <Row label={n.smtp}><span style={{ fontSize: 13 }}>{notify.smtp ? n.smtpOk : n.smtpMissing}</span></Row>
          <Row label={n.to}><span style={{ fontSize: 13, textAlign: "right" }}>{notify.recipients.length ? notify.recipients.join(", ") : n.none}</span></Row>
          <Row label={n.queued}><span style={{ fontSize: 13 }}>{notify.queued}</span></Row>
          <Row label={n.lastSent}><span style={{ fontSize: 13 }}>{fmt(notify.lastSent)}</span></Row>
          {notify.lastError && <Row label={n.lastError}><span style={{ fontSize: 12.5, color: "var(--danger-600)", textAlign: "right" }}>{notify.lastError}</span></Row>}
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 0" }}>
        <Button variant="secondary" size="sm" disabled={!configured || busy || backend !== "ok"} iconLeft={<Icon name="mail" size={14} />} onClick={test}>{busy ? n.testing : n.test}</Button>
        {msg && <span role="status" style={{ fontSize: 12.5, color: msg.ok ? "var(--success-600)" : "var(--danger-600)" }}>{msg.text}</span>}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{n.setup}</p>
    </Card>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{label}</span>
      {children}
    </div>
  );
}

export function Settings({ lang, ws, setLang, appearance, backend, notify, setNotify }) {
  const { theme, setTheme, accent, setAccent, effectiveAccent } = appearance;
  const [saved, setSaved] = React.useState(false);
  const tRoot = tFor(lang, ws);
  const t = tRoot.settings;
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
      <Card padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
          {/* Workspace card, not a user profile: there are no accounts, so an
              avatar with a job title read as a logged-in person who doesn't exist. */}
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--on-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 44px" }}><Icon name={ws.icon} size={20} /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-heading)", fontFamily: "var(--font-display)" }}>{tRoot.app}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{tRoot.product}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Row label={t.dept}><Badge tone="brand">{tRoot.wsLabel}</Badge></Row>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card padding="lg" header={t.preferences}>
          <Row label={t.language}>
            <Select value={lang} onChange={(e) => { setLang(e.target.value); flash(); }}
              options={[{ value: "pl", label: "Polski" }, { value: "de", label: "Deutsch" }, { value: "en", label: "English" }]}
              style={{ width: 150 }} />
          </Row>
          <Row label={t.theme}>
            <div role="radiogroup" aria-label={t.theme} style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
              {THEMES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={theme === m} onClick={() => { setTheme(m); flash(); }} style={{
                  border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600,
                  background: theme === m ? "var(--brand)" : "transparent", color: theme === m ? "var(--on-brand)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6,
                }}><Icon name={THEME_ICON[m]} size={13} />{t.themes[m]}</button>
              ))}
            </div>
          </Row>
          <div style={{ padding: "13px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{t.accent}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{accent === "auto" ? `${t.accentAuto} · ${tRoot.accents[effectiveAccent]}` : tRoot.accents[accent]}</span>
            </div>
            <div role="radiogroup" aria-label={t.accent} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" role="radio" aria-checked={accent === "auto"} title={t.accentAuto} onClick={() => { setAccent("auto"); flash(); }} style={{
                height: 34, padding: "0 12px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600,
                border: `2px solid ${accent === "auto" ? "var(--brand)" : "var(--border-default)"}`, background: "var(--surface)", color: "var(--text-heading)", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-flex" }}>{WORKSPACES.map((w) => <span key={w.id} style={{ width: 10, height: 10, borderRadius: "50%", background: SWATCH[w.accent], marginLeft: -2, border: "1px solid var(--surface)" }} />)}</span>
                {t.accentAuto}
              </button>
              {ACCENTS.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={accent === a} aria-label={tRoot.accents[a]} title={tRoot.accents[a]} onClick={() => { setAccent(a); flash(); }} style={{
                  width: 34, height: 34, borderRadius: "50%", cursor: "pointer", background: SWATCH[a],
                  border: `3px solid ${accent === a ? "var(--text-heading)" : "var(--surface)"}`, boxShadow: "0 0 0 1px var(--border-default)",
                }} />
              ))}
            </div>
          </div>
        </Card>

        <NotifyCard lang={lang} ws={ws} backend={backend} notify={notify} setNotify={setNotify} />

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--success-600)", background: "var(--success-100)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
            <Icon name="check-circle-2" size={14} />{t.saved}
          </div>
        )}
      </div>
    </div>
  );
}
