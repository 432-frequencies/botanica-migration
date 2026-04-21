import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Download,
  Mail,
  RefreshCw,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import {
  AFFILIATE_CONTRACT_TERM_OPTIONS,
  AFFILIATE_PRO_PAYOUT_EUR,
  AFFILIATE_PRO_REFERENCE_PRICE_EUR,
} from "@/lib/affiliate-config";
import { createApiUrl } from "@/lib/app-config";
import { useAdminStatus } from "@/hooks/useAdminStatus";

const G = "#39FF14";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriodLabel(periodKey) {
  if (!periodKey) return "ce mois";
  const [year, month] = String(periodKey).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function getStatusMeta(status) {
  if (status === "paid") {
    return {
      label: "Payé",
      color: G,
      background: "rgba(57,255,20,0.08)",
      border: "1px solid rgba(57,255,20,0.24)",
    };
  }

  if (status === "partial") {
    return {
      label: "Partiel",
      color: "#F6D365",
      background: "rgba(246,211,101,0.08)",
      border: "1px solid rgba(246,211,101,0.24)",
    };
  }

  if (status === "pending") {
    return {
      label: "À payer",
      color: "#FFB86B",
      background: "rgba(255,184,107,0.08)",
      border: "1px solid rgba(255,184,107,0.24)",
    };
  }

  return {
    label: "Aucun dû",
    color: "rgba(232,224,208,0.45)",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

function buildCsvRows(ambassadors, periodKey) {
  const header = [
    "Partenaire",
    "Code",
    "Email",
    "Affilies",
    "Pro actifs",
    "Du mois",
    "Paye ce mois",
    "Reste a payer",
    "Statut",
    "Contrat (mois)",
    "Validite",
    "Periode",
  ];

  const rows = ambassadors.map((ambassador) => [
    ambassador.name,
    ambassador.code,
    ambassador.contact_email,
    ambassador.total_referrals,
    ambassador.active_pro_users,
    ambassador.estimated_current_due,
    ambassador.paid_this_month,
    ambassador.outstanding_this_month,
    ambassador.payout_status,
    ambassador.contract_term_months || "",
    ambassador.current_contract
      ? `${ambassador.current_contract.valid_from || ""} -> ${ambassador.current_contract.valid_until || ""}`
      : "",
    periodKey,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function ContractBadge({ contract, termMonths }) {
  if (!contract) {
    return (
      <span
        className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.24em]"
        style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(232,224,208,0.45)" }}
      >
        Aucun contrat actif
      </span>
    );
  }

  return (
    <span
      className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.24em]"
      style={{ border: "1px solid rgba(57,255,20,0.35)", color: G, background: "rgba(57,255,20,0.08)" }}
    >
      {formatCurrency(AFFILIATE_PRO_PAYOUT_EUR)} / Pro {termMonths ? `· ${termMonths} mois` : ""}
    </span>
  );
}

function PayoutPanel({ ambassador, periodKey, onMarkPaid, onReopenPaid, busy }) {
  const statusMeta = getStatusMeta(ambassador.payout_status);

  return (
    <div
      className="p-3.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(232,224,208,0.38)" }}>
            Période {formatPeriodLabel(periodKey)}
          </p>
          <p className="text-sm font-black mt-1" style={{ color: "#E8E0D0" }}>
            {formatCurrency(ambassador.outstanding_this_month)} à régler
          </p>
          <p className="text-[11px] mt-1" style={{ color: "rgba(232,224,208,0.52)" }}>
            Dû brut {formatCurrency(ambassador.estimated_current_due)} · Déjà pointé payé {formatCurrency(ambassador.paid_this_month)}
          </p>
          {ambassador.payout_record?.paid_at && (
            <p className="text-[10px] mt-1" style={{ color: "rgba(232,224,208,0.42)" }}>
              Paiement enregistré le {formatDate(ambassador.payout_record.paid_at)} par {ambassador.payout_record.paid_by_email || "admin"}.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.24em]"
            style={{ color: statusMeta.color, background: statusMeta.background, border: statusMeta.border }}
          >
            {statusMeta.label}
          </span>

          {ambassador.outstanding_this_month > 0 && (
            <button
              onClick={() => onMarkPaid(ambassador.id)}
              disabled={busy}
              className="min-h-[40px] px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em]"
              style={{
                color: G,
                background: "rgba(57,255,20,0.08)",
                border: "1px solid rgba(57,255,20,0.2)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Enregistrement..." : "Marquer payé"}
            </button>
          )}

          {ambassador.payout_status === "paid" && (
            <button
              onClick={() => onReopenPaid(ambassador.id)}
              disabled={busy}
              className="min-h-[40px] px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em]"
              style={{
                color: "rgba(232,224,208,0.7)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Ouverture..." : "Rouvrir"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractComposer({ ambassador, onCreateContract, busy }) {
  const [startDate, setStartDate] = useState(ambassador.suggested_contract_start || "");

  useEffect(() => {
    setStartDate(ambassador.suggested_contract_start || "");
  }, [ambassador.suggested_contract_start]);

  return (
    <div
      className="p-3.5"
      style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.1)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(232,224,208,0.38)" }}>
            Nouveau contrat
          </p>
          <p className="text-[11px] mt-1" style={{ color: "rgba(232,224,208,0.56)" }}>
            Lance ou renouvelle un deal standard: {formatCurrency(AFFILIATE_PRO_PAYOUT_EUR)} reversés par Pro actif.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full sm:w-[180px] min-h-[40px] px-3 text-[11px] font-black uppercase tracking-[0.12em] outline-none"
            style={{
              color: "#E8E0D0",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(57,255,20,0.18)",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {AFFILIATE_CONTRACT_TERM_OPTIONS.map((termMonths) => (
          <button
            key={`${ambassador.id}-${termMonths}`}
            onClick={() => onCreateContract(ambassador.id, termMonths, startDate)}
            disabled={busy || !startDate}
            className="min-h-[42px] px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em]"
            style={{
              color: G,
              background: "rgba(57,255,20,0.08)",
              border: "1px solid rgba(57,255,20,0.2)",
              opacity: busy || !startDate ? 0.55 : 1,
            }}
          >
            {busy ? "..." : `${termMonths} mois`}
          </button>
        ))}
      </div>
    </div>
  );
}

function AmbassadorCard({ ambassador, periodKey, busyKey, onMarkPaid, onReopenPaid, onCreateContract }) {
  const [open, setOpen] = useState(false);
  const statusMeta = getStatusMeta(ambassador.payout_status);
  const busy = busyKey?.startsWith(ambassador.id);

  return (
    <div style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.12)" }}>
      <button onClick={() => setOpen((prev) => !prev)} className="w-full px-4 py-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "#E8E0D0" }}>
                {ambassador.name}
              </p>
              <span
                className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.24em]"
                style={{ background: "rgba(57,255,20,0.1)", color: G, border: "1px solid rgba(57,255,20,0.2)" }}
              >
                {ambassador.code}
              </span>
              <span
                className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.24em]"
                style={{ color: statusMeta.color, background: statusMeta.background, border: statusMeta.border }}
              >
                {statusMeta.label}
              </span>
              {!ambassador.is_active && (
                <span
                  className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.24em]"
                  style={{ background: "rgba(255,80,80,0.08)", color: "#FF6B6B", border: "1px solid rgba(255,80,80,0.2)" }}
                >
                  Inactif
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-3.5 h-3.5" style={{ color: "rgba(232,224,208,0.45)" }} />
              <p className="text-[11px]" style={{ color: "rgba(232,224,208,0.55)" }}>
                {ambassador.contact_email}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "Affiliés", value: ambassador.total_referrals },
                { label: "Pro actifs", value: ambassador.active_pro_users },
                { label: "Dû brut", value: formatCurrency(ambassador.estimated_current_due) },
                { label: "Payé", value: formatCurrency(ambassador.paid_this_month) },
                { label: "Reste", value: formatCurrency(ambassador.outstanding_this_month) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-3 py-2.5"
                  style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.08)" }}
                >
                  <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(232,224,208,0.38)" }}>
                    {item.label}
                  </p>
                  <p className="text-sm font-black mt-1" style={{ color: item.label === "Reste" ? G : "#E8E0D0" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <ContractBadge contract={ambassador.current_contract} termMonths={ambassador.contract_term_months} />
            <ChevronDown
              className="w-4 h-4 transition-transform"
              style={{ color: "rgba(232,224,208,0.45)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div style={{ height: 1, background: "rgba(57,255,20,0.1)" }} />

          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(232,224,208,0.38)" }}>
                Contrat en cours
              </p>
              <p className="text-[11px] font-black mt-1" style={{ color: "#E8E0D0" }}>
                {ambassador.current_contract ? `${formatCurrency(AFFILIATE_PRO_PAYOUT_EUR)} / Pro actif` : "Aucun"}
              </p>
            </div>

            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(232,224,208,0.38)" }}>
                Durée
              </p>
              <p className="text-[11px] font-black mt-1" style={{ color: "#E8E0D0" }}>
                {ambassador.contract_term_months ? `${ambassador.contract_term_months} mois` : "À définir"}
              </p>
            </div>

            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(232,224,208,0.38)" }}>
                Validité
              </p>
              <p className="text-[11px] font-black mt-1" style={{ color: "#E8E0D0" }}>
                {ambassador.current_contract
                  ? `${formatDate(ambassador.current_contract.valid_from)} → ${formatDate(ambassador.current_contract.valid_until)}`
                  : "Pas de fenêtre active"}
              </p>
            </div>

            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(232,224,208,0.38)" }}>
                Proposition
              </p>
              <p className="text-[11px] font-black mt-1" style={{ color: "#E8E0D0" }}>
                {formatCurrency(AFFILIATE_PRO_PAYOUT_EUR)} sur {formatCurrency(AFFILIATE_PRO_REFERENCE_PRICE_EUR)}
              </p>
            </div>
          </div>

          <PayoutPanel
            ambassador={ambassador}
            periodKey={periodKey}
            onMarkPaid={onMarkPaid}
            onReopenPaid={onReopenPaid}
            busy={busy}
          />

          <ContractComposer
            ambassador={ambassador}
            onCreateContract={onCreateContract}
            busy={busy}
          />

          {ambassador.recent_referrals.length === 0 ? (
            <div className="px-3 py-4 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(232,224,208,0.4)" }}>
                Aucun affilié rattaché pour l'instant
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(232,224,208,0.42)" }}>
                Derniers affiliés
              </p>
              {ambassador.recent_referrals.map((referral) => (
                <div
                  key={`${ambassador.code}-${referral.user_email}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-black truncate" style={{ color: "#E8E0D0" }}>
                      {referral.user_email}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(232,224,208,0.4)" }}>
                      Inscrit le {formatDate(referral.referred_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-[9px] font-black uppercase tracking-[0.22em]"
                      style={{ color: referral.is_pro ? G : "rgba(232,224,208,0.45)" }}
                    >
                      {referral.is_pro ? "Pro" : "Free"}
                    </p>
                    <p className="text-[9px]" style={{ color: "rgba(232,224,208,0.38)" }}>
                      {referral.total_points || 0} XP
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAffiliates() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    summary: null,
    ambassadors: [],
    userEmail: "",
  });
  const [busyKey, setBusyKey] = useState("");
  const { checking: adminChecking, isAdmin } = useAdminStatus();

  const loadDashboard = async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const {
        data: { session, user },
      } = await supabase.auth.getSession();

      const currentUser = user || session?.user;
      const userEmail = currentUser?.email || "";

      if (!session?.access_token) {
        setState({ loading: false, error: "Session admin requise.", summary: null, ambassadors: [], userEmail });
        return;
      }

      const response = await fetch(createApiUrl("/api/affiliate-admin"), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Impossible de charger le tableau d'affiliation");
      }

      setState({
        loading: false,
        error: "",
        summary: payload.summary || null,
        ambassadors: payload.ambassadors || [],
        userEmail,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || "Impossible de charger le tableau d'affiliation",
      }));
    }
  };

  const runAdminAction = async (action, body, actionKey) => {
    setBusyKey(actionKey);
    setState((prev) => ({ ...prev, error: "" }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session admin requise.");
      }

      const response = await fetch(createApiUrl("/api/affiliate-admin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...body }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Impossible d'appliquer l'action admin");
      }

      setState((prev) => ({
        ...prev,
        error: "",
        summary: payload.summary || prev.summary,
        ambassadors: payload.ambassadors || prev.ambassadors,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error?.message || "Impossible d'appliquer l'action admin",
      }));
    } finally {
      setBusyKey("");
    }
  };

  const handleMarkPaid = (ambassadorId) => runAdminAction("mark-paid", { ambassadorId }, `${ambassadorId}:mark`);
  const handleReopenPaid = (ambassadorId) => runAdminAction("reopen-paid", { ambassadorId }, `${ambassadorId}:reopen`);
  const handleCreateContract = (ambassadorId, termMonths, validFrom) => (
    runAdminAction("create-contract", { ambassadorId, termMonths, validFrom }, `${ambassadorId}:contract:${termMonths}`)
  );

  const handleExport = () => {
    const content = buildCsvRows(state.ambassadors, state.summary?.current_period_key || "");
    downloadCsv(`affiliation-${state.summary?.current_period_key || "w1ld"}.csv`, content);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (adminChecking || state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050A05" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-24" style={{ background: "#050A05", color: "#E8E0D0" }}>
        <div className="max-w-md mx-auto p-6 text-center" style={{ border: "1px solid rgba(57,255,20,0.15)", background: "rgba(57,255,20,0.03)" }}>
          <Shield className="w-8 h-8 mx-auto mb-4" style={{ color: "rgba(57,255,20,0.45)" }} />
          <p className="text-xs font-black uppercase tracking-[0.34em] mb-2" style={{ color: "rgba(57,255,20,0.55)" }}>
            Console verrouillée
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(232,224,208,0.68)" }}>
            Cette vue est réservée à un compte administrateur vérifié côté serveur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#050A05", color: "#E8E0D0" }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(57,255,20,0.05) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 px-5 pt-5 pb-24 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.45em] mb-1" style={{ color: "rgba(57,255,20,0.45)" }}>
              Admin · Affiliation
            </p>
            <h1 className="text-2xl font-black uppercase tracking-[0.08em]" style={{ color: G }}>
              Influenceurs & paiements
            </h1>
            <p className="text-[11px] mt-2 max-w-2xl" style={{ color: "rgba(232,224,208,0.55)" }}>
              Console de pilotage des partenaires: contrat, dû mensuel, statut payé et export rapide pour ta compta.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="min-h-[44px] px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#E8E0D0" }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={loadDashboard}
              className="min-h-[44px] px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] flex items-center gap-2"
              style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)", color: G }}
            >
              <RefreshCw className="w-4 h-4" />
              Rafraîchir
            </button>
          </div>
        </div>

        {state.error && (
          <div className="px-4 py-3 mb-5" style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#FF6B6B" }}>
            {state.error}
          </div>
        )}

        {state.summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {[
              { label: "Partenaires actifs", value: state.summary.active_ambassadors, color: "#E8E0D0", icon: Users },
              { label: "Affiliés totaux", value: state.summary.total_referrals, color: "#E8E0D0", icon: Users },
              { label: "Pro actifs", value: state.summary.active_pro_users, color: "#E8E0D0", icon: CheckCircle2 },
              { label: "Dû du mois", value: formatCurrency(state.summary.due_this_month), color: G, icon: Wallet },
              { label: "Déjà marqué payé", value: formatCurrency(state.summary.paid_this_month), color: "#8EF39C", icon: CheckCircle2 },
              { label: "Reste à payer", value: formatCurrency(state.summary.outstanding_this_month), color: "#FFB86B", icon: Wallet },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="p-4"
                  style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.12)" }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" style={{ color: "rgba(232,224,208,0.45)" }} />
                    <p className="text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(232,224,208,0.4)" }}>
                      {item.label}
                    </p>
                  </div>
                  <p className="text-2xl font-black mt-2" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {state.summary?.setup_required && (
          <div className="px-4 py-3 mb-5" style={{ background: "rgba(255,184,107,0.08)", border: "1px solid rgba(255,184,107,0.24)", color: "#FFB86B" }}>
            {state.summary.setup_message} La console est prête côté app, mais il faut encore exécuter la migration SQL des tables d'affiliation sur Supabase.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 mb-5">
          <div className="px-4 py-3 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Wallet className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: G }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,224,208,0.55)" }}>
              Règle actuelle: <strong>{formatCurrency(state.summary?.payout_per_active_pro_eur || AFFILIATE_PRO_PAYOUT_EUR)}</strong> reversés à l'influenceur par <strong>abonné Pro actif</strong> pendant la durée du contrat. Base commerciale suivie: <strong>{formatCurrency(state.summary?.pro_reference_price_eur || AFFILIATE_PRO_REFERENCE_PRICE_EUR)}</strong>.
            </p>
          </div>

          <div className="px-4 py-3 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <CalendarRange className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: G }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,224,208,0.55)" }}>
              Durées standard disponibles: <strong>{(state.summary?.supported_terms_months || AFFILIATE_CONTRACT_TERM_OPTIONS).join(" · ")} mois</strong>. Chaque carte permet de lancer un nouveau contrat à partir de la date choisie.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {state.ambassadors.length === 0 ? (
            <div className="p-6 text-center" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.12)" }}>
              <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(57,255,20,0.55)" }}>
                Aucun partenaire enregistré
              </p>
            </div>
          ) : (
            state.ambassadors.map((ambassador) => (
              <AmbassadorCard
                key={ambassador.code}
                ambassador={ambassador}
                periodKey={state.summary?.current_period_key}
                busyKey={busyKey}
                onMarkPaid={handleMarkPaid}
                onReopenPaid={handleReopenPaid}
                onCreateContract={handleCreateContract}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
