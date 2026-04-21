import {
  AFFILIATE_CONTRACT_TERM_OPTIONS,
  AFFILIATE_PRO_PAYOUT_EUR,
  AFFILIATE_PRO_REFERENCE_PRICE_EUR,
  isSupportedAffiliateTerm,
} from "../src/lib/affiliate-config.js";
import { authenticateAdminRequest } from "./_adminAuth.js";

function isMissingTableError(error, tableName) {
  const message = error?.message || "";
  return message.includes(`public.${tableName}`) && message.includes("schema cache");
}

function parseDateOnly(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonthsInclusive(validFrom, termMonths) {
  const startDate = parseDateOnly(validFrom);
  if (!startDate) return null;
  const endDate = new Date(startDate.getTime());
  endDate.setUTCMonth(endDate.getUTCMonth() + Number(termMonths));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return formatDateOnly(endDate);
}

function getContractTermMonths(contract) {
  const startDate = parseDateOnly(contract?.valid_from);
  const endDate = parseDateOnly(contract?.valid_until);
  if (!startDate || !endDate) return null;

  const exclusiveEnd = new Date(endDate.getTime());
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  const months = (
    (exclusiveEnd.getUTCFullYear() - startDate.getUTCFullYear()) * 12
    + (exclusiveEnd.getUTCMonth() - startDate.getUTCMonth())
  );

  return exclusiveEnd.getUTCDate() === startDate.getUTCDate() ? months : null;
}

function getContractConflict(existingContracts, validFrom, validUntil) {
  return existingContracts.find((contract) => {
    const contractStart = contract.valid_from;
    const contractEnd = contract.valid_until || "9999-12-31";
    return contractStart <= validUntil && contractEnd >= validFrom;
  }) || null;
}

function isActiveContract(contract, now = new Date()) {
  if (!contract?.valid_from) return false;

  const today = formatDateOnly(now);
  if (!today || contract.valid_from > today) return false;

  if (!contract.valid_until) return true;

  const gracePeriodDays = Number(contract.grace_period_days || 0);
  const validUntilWithGrace = parseDateOnly(contract.valid_until);
  if (!validUntilWithGrace) return false;
  validUntilWithGrace.setUTCDate(validUntilWithGrace.getUTCDate() + gracePeriodDays);

  return formatDateOnly(validUntilWithGrace) >= today;
}

function isCurrentlyPro(profile, now = new Date()) {
  if (!profile?.is_pro) return false;
  if (!profile?.pro_until) return true;
  const proUntil = parseDateOnly(String(profile.pro_until).slice(0, 10));
  if (!proUntil) return true;
  return formatDateOnly(proUntil) >= formatDateOnly(now);
}

function parseAmbassadorNotes(notes) {
  if (!notes) {
    return { manual_note: "", payout_ledger: {} };
  }

  if (typeof notes === "string") {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          ...parsed,
          manual_note: typeof parsed.manual_note === "string" ? parsed.manual_note : "",
          payout_ledger: parsed.payout_ledger && typeof parsed.payout_ledger === "object" ? parsed.payout_ledger : {},
        };
      }
    } catch {
      return { manual_note: notes, payout_ledger: {} };
    }
  }

  return { manual_note: "", payout_ledger: {} };
}

function serializeAmbassadorNotes(metadata) {
  const payoutLedger = metadata?.payout_ledger && typeof metadata.payout_ledger === "object"
    ? Object.fromEntries(
      Object.entries(metadata.payout_ledger).filter(([, value]) => value && typeof value === "object")
    )
    : {};
  const manualNote = typeof metadata?.manual_note === "string" ? metadata.manual_note.trim() : "";

  if (!manualNote && Object.keys(payoutLedger).length === 0) {
    return null;
  }

  if (manualNote && Object.keys(payoutLedger).length === 0) {
    return manualNote;
  }

  return JSON.stringify({
    manual_note: manualNote,
    payout_ledger: payoutLedger,
  });
}

function computeCommission(activeProCount, contract) {
  if (!contract || !activeProCount) return 0;
  return activeProCount * AFFILIATE_PRO_PAYOUT_EUR;
}

function sanitizePayoutRecord(record, fallbackDue) {
  if (!record || typeof record !== "object") return null;

  const amountDue = Number(record.amount_due || fallbackDue || 0);
  const amountPaid = Number(record.amount_paid ?? amountDue ?? 0);

  return {
    status: record.status || (amountPaid >= amountDue && amountDue > 0 ? "paid" : "pending"),
    amount_due: Number(amountDue.toFixed(2)),
    amount_paid: Number(amountPaid.toFixed(2)),
    paid_at: record.paid_at || null,
    paid_by_email: record.paid_by_email || null,
  };
}

function buildAmbassadorSnapshot(ambassador, contracts, referrals, now, currentPeriodKey) {
  const ambassadorContracts = contracts
    .filter((contract) => contract.ambassador_id === ambassador.id)
    .sort((a, b) => (b.valid_from || "").localeCompare(a.valid_from || ""));

  const activeContract = ambassadorContracts.find((contract) => isActiveContract(contract, now)) || null;
  const fallbackContract = activeContract || ambassadorContracts[0] || null;
  const contractTermMonths = getContractTermMonths(fallbackContract);
  const ambassadorReferrals = referrals.filter((referral) => referral.referred_by_code === ambassador.code);
  const activeProUsers = ambassadorReferrals.filter((referral) => isCurrentlyPro(referral, now));
  const estimatedDue = Number(computeCommission(activeProUsers.length, activeContract).toFixed(2));
  const metadata = parseAmbassadorNotes(ambassador.notes);
  const payoutRecord = sanitizePayoutRecord(metadata.payout_ledger?.[currentPeriodKey], estimatedDue);
  const paidThisMonth = Number(Math.min(payoutRecord?.amount_paid || 0, estimatedDue).toFixed(2));
  const outstandingThisMonth = Number(Math.max(estimatedDue - paidThisMonth, 0).toFixed(2));

  let payoutStatus = "no_due";
  if (estimatedDue > 0 && paidThisMonth === 0) payoutStatus = "pending";
  if (estimatedDue > 0 && paidThisMonth > 0 && paidThisMonth < estimatedDue) payoutStatus = "partial";
  if (estimatedDue > 0 && paidThisMonth >= estimatedDue) payoutStatus = "paid";

  const mostRecentContract = ambassadorContracts[0] || null;
  const suggestedStartDate = mostRecentContract?.valid_until && parseDateOnly(mostRecentContract.valid_until)
    ? formatDateOnly(new Date(parseDateOnly(mostRecentContract.valid_until).getTime() + 86400000))
    : formatDateOnly(now);

  return {
    ...ambassador,
    total_referrals: ambassadorReferrals.length,
    free_users: ambassadorReferrals.filter((referral) => !referral.is_pro).length,
    pro_users: ambassadorReferrals.filter((referral) => referral.is_pro).length,
    active_pro_users: activeProUsers.length,
    estimated_monthly_commission: estimatedDue,
    estimated_current_due: estimatedDue,
    paid_this_month: paidThisMonth,
    outstanding_this_month: outstandingThisMonth,
    payout_status: payoutStatus,
    payout_record: payoutRecord,
    current_contract: fallbackContract,
    contract_term_months: contractTermMonths,
    suggested_contract_start: suggestedStartDate,
    recent_referrals: ambassadorReferrals.slice(0, 12),
    manual_note: metadata.manual_note || "",
  };
}

async function loadDashboardData(adminClient, now = new Date()) {
  const currentPeriodKey = getMonthKey(now);
  const [ambassadorsRes, contractsRes, referralsRes] = await Promise.all([
    adminClient
      .from("ambassadors")
      .select("id, code, name, contact_email, is_active, notes, created_at")
      .order("created_at", { ascending: true }),
    adminClient
      .from("ambassador_contracts")
      .select("id, ambassador_id, valid_from, valid_until, rate_type, rate_value, grace_period_days, notes")
      .order("valid_from", { ascending: false }),
    adminClient
      .from("user_profiles")
      .select("user_email, referred_by_code, referred_at, is_pro, pro_since, pro_until, total_points, total_plants")
      .not("referred_by_code", "is", null)
      .order("referred_at", { ascending: false }),
  ]);

  if (isMissingTableError(ambassadorsRes.error, "ambassadors") || isMissingTableError(contractsRes.error, "ambassador_contracts")) {
    return {
      summary: {
        active_ambassadors: 0,
        total_referrals: 0,
        active_pro_users: 0,
        due_this_month: 0,
        paid_this_month: 0,
        outstanding_this_month: 0,
        estimated_monthly_commission: 0,
        payout_per_active_pro_eur: AFFILIATE_PRO_PAYOUT_EUR,
        pro_reference_price_eur: AFFILIATE_PRO_REFERENCE_PRICE_EUR,
        supported_terms_months: AFFILIATE_CONTRACT_TERM_OPTIONS,
        current_period_key: currentPeriodKey,
        setup_required: true,
        setup_message: "Les tables d'affiliation ne sont pas encore créées en production.",
      },
      ambassadors: [],
    };
  }

  if (ambassadorsRes.error) throw ambassadorsRes.error;
  if (contractsRes.error) throw contractsRes.error;
  if (referralsRes.error) throw referralsRes.error;

  const ambassadors = ambassadorsRes.data || [];
  const contracts = contractsRes.data || [];
  const referrals = referralsRes.data || [];

  const dashboard = ambassadors.map((ambassador) => (
    buildAmbassadorSnapshot(ambassador, contracts, referrals, now, currentPeriodKey)
  )).sort((a, b) => (
    (b.outstanding_this_month || 0) - (a.outstanding_this_month || 0)
    || (b.active_pro_users || 0) - (a.active_pro_users || 0)
    || (b.total_referrals || 0) - (a.total_referrals || 0)
  ));

  const summary = {
    active_ambassadors: dashboard.filter((ambassador) => ambassador.is_active).length,
    total_referrals: dashboard.reduce((sum, ambassador) => sum + ambassador.total_referrals, 0),
    active_pro_users: dashboard.reduce((sum, ambassador) => sum + ambassador.active_pro_users, 0),
    due_this_month: Number(
      dashboard.reduce((sum, ambassador) => sum + (ambassador.estimated_current_due || 0), 0).toFixed(2)
    ),
    paid_this_month: Number(
      dashboard.reduce((sum, ambassador) => sum + (ambassador.paid_this_month || 0), 0).toFixed(2)
    ),
    outstanding_this_month: Number(
      dashboard.reduce((sum, ambassador) => sum + (ambassador.outstanding_this_month || 0), 0).toFixed(2)
    ),
    estimated_monthly_commission: Number(
      dashboard.reduce((sum, ambassador) => sum + (ambassador.estimated_monthly_commission || 0), 0).toFixed(2)
    ),
    payout_per_active_pro_eur: AFFILIATE_PRO_PAYOUT_EUR,
    pro_reference_price_eur: AFFILIATE_PRO_REFERENCE_PRICE_EUR,
    supported_terms_months: AFFILIATE_CONTRACT_TERM_OPTIONS,
    current_period_key: currentPeriodKey,
  };

  return { summary, ambassadors: dashboard };
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

async function handleMarkPaid(adminClient, user, ambassadorId, now) {
  const dashboard = await loadDashboardData(adminClient, now);
  const ambassador = dashboard.ambassadors.find((entry) => entry.id === ambassadorId);

  if (!ambassador) {
    return { status: 404, payload: { error: "Partenaire introuvable" } };
  }

  const metadata = parseAmbassadorNotes(ambassador.notes);
  metadata.payout_ledger = metadata.payout_ledger || {};
  metadata.payout_ledger[dashboard.summary.current_period_key] = {
    status: "paid",
    amount_due: ambassador.estimated_current_due,
    amount_paid: ambassador.estimated_current_due,
    paid_at: now.toISOString(),
    paid_by_email: user.email,
  };

  const { error } = await adminClient
    .from("ambassadors")
    .update({ notes: serializeAmbassadorNotes(metadata) })
    .eq("id", ambassadorId);

  if (error) {
    throw error;
  }

  return { status: 200, payload: await loadDashboardData(adminClient, now) };
}

async function handleReopenPaid(adminClient, ambassadorId, now) {
  const dashboard = await loadDashboardData(adminClient, now);
  const ambassador = dashboard.ambassadors.find((entry) => entry.id === ambassadorId);

  if (!ambassador) {
    return { status: 404, payload: { error: "Partenaire introuvable" } };
  }

  const metadata = parseAmbassadorNotes(ambassador.notes);
  metadata.payout_ledger = metadata.payout_ledger || {};
  delete metadata.payout_ledger[dashboard.summary.current_period_key];

  const { error } = await adminClient
    .from("ambassadors")
    .update({ notes: serializeAmbassadorNotes(metadata) })
    .eq("id", ambassadorId);

  if (error) {
    throw error;
  }

  return { status: 200, payload: await loadDashboardData(adminClient, now) };
}

async function handleCreateContract(adminClient, ambassadorId, termMonths, validFrom) {
  if (!ambassadorId) {
    return { status: 400, payload: { error: "Ambassadeur requis" } };
  }

  if (!isSupportedAffiliateTerm(termMonths)) {
    return { status: 400, payload: { error: "Durée de contrat invalide" } };
  }

  if (!parseDateOnly(validFrom)) {
    return { status: 400, payload: { error: "Date de début invalide" } };
  }

  const validUntil = addMonthsInclusive(validFrom, termMonths);
  if (!validUntil) {
    return { status: 400, payload: { error: "Impossible de calculer la date de fin" } };
  }

  const { data: existingContracts, error: contractsError } = await adminClient
    .from("ambassador_contracts")
    .select("id, valid_from, valid_until")
    .eq("ambassador_id", ambassadorId)
    .order("valid_from", { ascending: false });

  if (contractsError) {
    throw contractsError;
  }

  const conflictingContract = getContractConflict(existingContracts || [], validFrom, validUntil);
  if (conflictingContract) {
    return {
      status: 409,
      payload: {
        error: `Un contrat existe déjà sur cette période (${conflictingContract.valid_from} → ${conflictingContract.valid_until || "ouverte"}).`,
      },
    };
  }

  const { error: insertError } = await adminClient
    .from("ambassador_contracts")
    .insert({
      ambassador_id: ambassadorId,
      valid_from: validFrom,
      valid_until: validUntil,
      rate_type: "fixed",
      rate_value: AFFILIATE_PRO_PAYOUT_EUR,
      grace_period_days: 0,
      notes: `Programme influenceur · ${AFFILIATE_PRO_PAYOUT_EUR}EUR / Pro actif · ${termMonths} mois`,
    });

  if (insertError) {
    throw insertError;
  }

  return { status: 200, payload: await loadDashboardData(adminClient) };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticateAdminRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { adminClient, user } = auth;
  const now = new Date();

  try {
    const initialDashboard = await loadDashboardData(adminClient, now);

    if (req.method === "GET") {
      return res.status(200).json(initialDashboard);
    }

    if (initialDashboard.summary?.setup_required) {
      return res.status(503).json({
        error: initialDashboard.summary.setup_message,
        ...initialDashboard,
      });
    }

    const body = getBody(req);
    const action = body.action;

    if (action === "mark-paid") {
      const result = await handleMarkPaid(adminClient, user, body.ambassadorId, now);
      return res.status(result.status).json(result.payload);
    }

    if (action === "reopen-paid") {
      const result = await handleReopenPaid(adminClient, body.ambassadorId, now);
      return res.status(result.status).json(result.payload);
    }

    if (action === "create-contract") {
      const result = await handleCreateContract(
        adminClient,
        body.ambassadorId,
        Number(body.termMonths),
        body.validFrom,
      );
      return res.status(result.status).json(result.payload);
    }

    return res.status(400).json({ error: "Action admin inconnue" });
  } catch (error) {
    console.error("[affiliate-admin] Failed to handle request:", error);
    return res.status(500).json({ error: "Impossible de piloter l'affiliation pour le moment" });
  }
}
