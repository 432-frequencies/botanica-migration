import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "@/lib/app-config";
import { useTranslation } from "@/lib/i18n";

function normalizePartnerCode(value = "") {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

const inputStyle = {
  width: "100%",
  background: "rgba(57,255,20,0.06)",
  border: "1px solid rgba(57,255,20,0.3)",
  color: "#E8E0D0",
  padding: "12px",
  fontSize: "14px",
  outline: "none",
  marginBottom: "8px",
  boxSizing: "border-box",
};

function LanguageChoice({ onSelect, t }) {
  return (
    <div style={{ width: "100%", maxWidth: "380px" }}>
      <h1 style={{ color: "#39FF14", fontWeight: 900, fontSize: "2rem", textTransform: "uppercase", marginBottom: "8px" }}>
        W1LD
      </h1>
      <p style={{ color: "rgba(57,255,20,0.45)", fontSize: "11px", letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: "30px" }}>
        Field OS
      </p>

      <div
        style={{
          background: "linear-gradient(145deg, rgba(57,255,20,0.08), rgba(255,255,255,0.025))",
          border: "1px solid rgba(57,255,20,0.18)",
          borderRadius: "28px",
          padding: "24px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <p style={{ color: "rgba(57,255,20,0.72)", fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "12px", fontWeight: 900 }}>
          {t("login.languageTitle")}
        </p>
        <p style={{ color: "#F2EDE4", fontSize: "22px", lineHeight: 1.12, fontWeight: 900, marginBottom: "12px" }}>
          {t("login.languageHeadline")}
        </p>
        <p style={{ color: "rgba(242,237,228,0.62)", fontSize: "13px", lineHeight: 1.6, marginBottom: "22px" }}>
          {t("login.languageSubtitle")}
        </p>

        <div style={{ display: "grid", gap: "10px" }}>
          <button
            type="button"
            onClick={() => onSelect("fr")}
            style={{
              minHeight: "58px",
              background: "rgba(57,255,20,0.14)",
              border: "1px solid rgba(57,255,20,0.34)",
              borderRadius: "18px",
              color: "#E8FFE8",
              fontWeight: 900,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {t("login.selectFrench")}
          </button>
          <button
            type="button"
            onClick={() => onSelect("en")}
            style={{
              minHeight: "58px",
              background: "rgba(255,255,255,0.045)",
              border: "1px solid rgba(255,255,255,0.11)",
              borderRadius: "18px",
              color: "#F2EDE4",
              fontWeight: 900,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {t("login.selectEnglish")}
          </button>
        </div>

        <p style={{ color: "rgba(242,237,228,0.42)", fontSize: "11px", lineHeight: 1.55, marginTop: "18px", marginBottom: 0 }}>
          {t("login.languageHint")}
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const { language, setLanguage, chooseLanguage, hasChosenLanguage, t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [ambassadorCode, setAmbassadorCode] = useState("");
  const [codeValidation, setCodeValidation] = useState({ valid: null, message: "" });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const validateAmbassadorCode = async (code) => {
    const normalizedCode = normalizePartnerCode(code);

    if (!normalizedCode) {
      setCodeValidation({ valid: null, message: "" });
      return;
    }

    try {
      const { data, error: validationError } = await supabase
        .from("ambassadors")
        .select("code")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (validationError) throw validationError;

      setCodeValidation(data
        ? { valid: true, message: t("login.validCode") }
        : { valid: false, message: t("login.unknownCode") });
    } catch (validationError) {
      console.warn("[Login] Partner code validation fallback:", validationError?.message || validationError);
      setCodeValidation({ valid: null, message: t("login.codeFallback") });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setDone("");

    if (mode === "signup") {
      const normalizedCode = normalizePartnerCode(ambassadorCode);
      if (normalizedCode) {
        localStorage.setItem("pending_ambassador_code", normalizedCode);
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            preferred_language: language,
          },
        },
      });

      if (signUpError) setError(signUpError.message);
      else setDone(t("login.created"));
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      else navigate("/", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050A05", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {!hasChosenLanguage ? (
        <LanguageChoice onSelect={chooseLanguage} t={t} />
      ) : (
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <h1 style={{ color: "#39FF14", fontWeight: 900, fontSize: "2rem", textTransform: "uppercase", marginBottom: "8px" }}>W1LD</h1>
              <p style={{ color: "rgba(57,255,20,0.4)", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "32px" }}>
                {mode === "login" ? t("login.loginTitle") : t("login.signupTitle")}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", paddingTop: "5px" }}>
              {["fr", "en"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLanguage(option)}
                  style={{
                    minHeight: "34px",
                    minWidth: "42px",
                    borderRadius: "999px",
                    border: option === language ? "1px solid rgba(57,255,20,0.58)" : "1px solid rgba(255,255,255,0.1)",
                    background: option === language ? "rgba(57,255,20,0.14)" : "rgba(255,255,255,0.035)",
                    color: option === language ? "#CFFFCA" : "rgba(242,237,228,0.55)",
                    fontSize: "10px",
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {done ? (
            <>
              <p style={{ color: "#39FF14", fontSize: "14px", marginBottom: "16px" }}>{done}</p>
              <button onClick={() => { setDone(""); setMode("login"); }} style={{ color: "rgba(57,255,20,0.6)", fontSize: "12px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                → {t("login.signIn")}
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("login.email")}
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.password")}
                required
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              {mode === "signup" && (
                <>
                  <input
                    type="text"
                    value={ambassadorCode}
                    onChange={(event) => {
                      const code = normalizePartnerCode(event.target.value);
                      setAmbassadorCode(code);
                      validateAmbassadorCode(code);
                    }}
                    placeholder={t("login.partnerCode")}
                    style={{
                      ...inputStyle,
                      border: codeValidation.valid === false ? "1px solid #FF4444" : "1px solid rgba(57,255,20,0.3)",
                    }}
                  />
                  {codeValidation.message && (
                    <p
                      style={{
                        color: codeValidation.valid === true ? "#39FF14" : codeValidation.valid === false ? "#FF4444" : "rgba(57,255,20,0.65)",
                        fontSize: "11px",
                        marginBottom: "8px",
                      }}
                    >
                      {codeValidation.message}
                    </p>
                  )}
                  <p style={{ color: "rgba(57,255,20,0.38)", fontSize: "11px", lineHeight: 1.5, marginBottom: "12px" }}>
                    {t("login.codeInfo")}
                  </p>
                </>
              )}
              {error && <p style={{ color: "#FF4444", fontSize: "12px", marginBottom: "8px" }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", background: "#39FF14", color: "#050A05", fontWeight: 900, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.3em", padding: "14px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginBottom: "16px" }}
              >
                {loading ? t("common.loading") : mode === "login" ? t("login.signIn") : t("login.createAccount")}
              </button>
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
                style={{ color: "rgba(57,255,20,0.5)", fontSize: "12px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}
              </button>
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(57,255,20,0.12)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <Link to="/privacy" style={{ color: "rgba(57,255,20,0.65)", fontSize: "12px" }}>
                    {t("login.privacy")}
                  </Link>
                  <Link to="/support" style={{ color: "rgba(57,255,20,0.65)", fontSize: "12px" }}>
                    {t("login.support")}
                  </Link>
                </div>
                <p style={{ color: "rgba(57,255,20,0.38)", fontSize: "11px", lineHeight: 1.5, margin: 0 }}>
                  {t("login.help", { email: SUPPORT_EMAIL })}
                </p>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
