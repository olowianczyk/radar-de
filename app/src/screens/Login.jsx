// Login — gate screen shown before the app shell. Trilingual, BSH-branded.
import React from "react";
import { Input, Checkbox, Button, Icon } from "../components/index.js";
import { HRBP_I18N } from "../data.js";

export function Login({ lang, setLang, onLogin }) {
  const [email, setEmail] = React.useState("hr.partner@bshg.com");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const t = HRBP_I18N[lang].login;

  const submit = (e) => {
    e.preventDefault();
    if (!email || !password) { setError(t.error); return; }
    setError(""); setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--canvas)", padding: 20, fontFamily: "var(--font-sans)" }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <div style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
          {["pl", "de", "en"].map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{
              border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
              background: lang === l ? "var(--brand)" : "transparent", color: lang === l ? "#fff" : "var(--text-muted)",
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 380, background: "var(--surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-subtle)", padding: "36px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <img src="/assets/logo-bsh.webp" alt="BSH" className="bsh-logo" style={{ height: 26, width: "auto" }} />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)" }}>{t.title}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{t.subtitle}</p>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} iconLeft={<Icon name="mail" size={16} />} required />
          <Input label={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} iconLeft={<Icon name="lock" size={16} />} required />
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--red-700)", background: "var(--red-100)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
              <Icon name="alert-circle" size={14} />{error}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Checkbox checked={remember} onChange={setRemember} label={t.remember} />
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12.5, color: "var(--brand)" }}>{t.forgot}</a>
          </div>
          <Button type="submit" variant="primary" fullWidth disabled={loading} iconLeft={loading ? <Icon name="loader-2" size={16} className="hrbp-spin" /> : null}>
            {t.submit}
          </Button>
        </form>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>lub</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>
        <Button variant="secondary" fullWidth iconLeft={<Icon name="shield-check" size={16} />}>{t.sso}</Button>
      </div>
    </div>
  );
}
