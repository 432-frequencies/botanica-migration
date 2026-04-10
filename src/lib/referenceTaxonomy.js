import { normalizeSpeciesCategory } from "./species.js";

const CANONICAL_REFERENCE_TAXA = [
  {
    common_name: "Pissenlit",
    scientific_name: "Taraxacum officinale",
    category: "plant",
    aliases: ["Pissenlit officinal"],
  },
  {
    common_name: "Chêne pédonculé",
    scientific_name: "Quercus robur",
    category: "tree",
    aliases: ["Chene pedoncule", "Chêne pédonculé"],
  },
  {
    common_name: "Platane",
    scientific_name: "Platanus x acerifolia",
    category: "tree",
    aliases: ["Platane commun"],
  },
  {
    common_name: "Érable champêtre",
    scientific_name: "Acer campestre",
    category: "tree",
    aliases: ["Erable champetre", "Érable champêtre"],
  },
  {
    common_name: "Merle noir",
    scientific_name: "Turdus merula",
    category: "bird",
  },
  {
    common_name: "Pigeon biset",
    scientific_name: "Columba livia",
    category: "bird",
  },
  {
    common_name: "Abeille domestique",
    scientific_name: "Apis mellifera",
    category: "insect",
    aliases: ["Abeille"],
  },
  {
    common_name: "Pâquerette",
    scientific_name: "Bellis perennis",
    category: "plant",
    aliases: ["Paquerette"],
  },
  {
    common_name: "Trèfle blanc",
    scientific_name: "Trifolium repens",
    category: "plant",
    aliases: ["Trefle blanc"],
  },
  {
    common_name: "Ortie",
    scientific_name: "Urtica dioica",
    category: "plant",
  },
  {
    common_name: "Tilleul",
    scientific_name: "Tilia cordata",
    category: "tree",
  },
  {
    common_name: "Lierre",
    scientific_name: "Hedera helix",
    category: "plant",
  },
  {
    common_name: "Champignon de pelouse",
    scientific_name: "Agaricus campestris",
    category: "fungus",
  },
  {
    common_name: "Coccinelle",
    scientific_name: "Coccinella septempunctata",
    category: "insect",
  },
  {
    common_name: "Moineau domestique",
    scientific_name: "Passer domesticus",
    category: "bird",
  },
];

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×]/g, "x")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function toSafeRecord(record) {
  return record && typeof record === "object" ? record : {};
}

function titleCaseWords(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettifyTaxon(taxon) {
  return {
    common_name: taxon.common_name,
    scientific_name: taxon.scientific_name
      .replace(/\bx\b/g, "×")
      .replace(/\s+/g, " ")
      .trim(),
    category: taxon.category,
  };
}

const TAXON_BY_COMMON = new Map();
const TAXON_BY_SCIENTIFIC = new Map();

for (const taxon of CANONICAL_REFERENCE_TAXA) {
  const prettyTaxon = prettifyTaxon(taxon);
  TAXON_BY_COMMON.set(normalizeKey(taxon.common_name), prettyTaxon);
  TAXON_BY_SCIENTIFIC.set(normalizeKey(taxon.scientific_name), prettyTaxon);
  for (const alias of taxon.aliases || []) {
    TAXON_BY_COMMON.set(normalizeKey(alias), prettyTaxon);
  }
}

export function getCanonicalReferenceTaxon(record = {}) {
  const safeRecord = toSafeRecord(record);
  const commonMatch = TAXON_BY_COMMON.get(normalizeKey(safeRecord.common_name));
  const scientificMatch = TAXON_BY_SCIENTIFIC.get(normalizeKey(safeRecord.scientific_name));

  if (commonMatch && scientificMatch) {
    return normalizeKey(commonMatch.scientific_name) === normalizeKey(scientificMatch.scientific_name)
      ? commonMatch
      : commonMatch;
  }

  return commonMatch || scientificMatch || null;
}

export function repairReferenceSpeciesRecord(record = {}) {
  const safeRecord = toSafeRecord(record);
  const canonical = getCanonicalReferenceTaxon(safeRecord);
  const nextRecord = {
    ...safeRecord,
    common_name: canonical?.common_name || safeRecord.common_name || "Espèce de référence",
    scientific_name: canonical?.scientific_name || safeRecord.scientific_name || null,
    category: canonical?.category || safeRecord.category || normalizeSpeciesCategory(safeRecord.category, safeRecord),
  };

  const normalizedCategory = normalizeSpeciesCategory(nextRecord.category, nextRecord);
  nextRecord.category = normalizedCategory;
  nextRecord.reference_canonical = canonical || null;
  nextRecord.reference_patched = Boolean(
    canonical && (
      normalizeKey(safeRecord.common_name) !== normalizeKey(canonical.common_name) ||
      normalizeKey(safeRecord.scientific_name) !== normalizeKey(canonical.scientific_name) ||
      normalizeKey(safeRecord.category) !== normalizeKey(canonical.category)
    )
  );

  return nextRecord;
}

export function isReferenceSpeciesSuspicious(record = {}) {
  const safeRecord = toSafeRecord(record);
  if (!safeRecord.common_name && !safeRecord.scientific_name) return true;

  const repaired = safeRecord.reference_canonical ? safeRecord : repairReferenceSpeciesRecord(safeRecord);
  const rawCategory = normalizeKey(safeRecord.category);
  const normalizedCategory = normalizeKey(normalizeSpeciesCategory(safeRecord.category, repaired));
  const canonical = repaired.reference_canonical;

  if (canonical) {
    const commonMismatch = normalizeKey(safeRecord.common_name) !== normalizeKey(canonical.common_name);
    const scientificMismatch = normalizeKey(safeRecord.scientific_name) !== normalizeKey(canonical.scientific_name);
    const categoryMismatch = rawCategory && rawCategory !== normalizeKey(canonical.category);
    return commonMismatch || scientificMismatch || categoryMismatch;
  }

  return Boolean(rawCategory && normalizedCategory && rawCategory !== normalizedCategory);
}

export function getReferenceFallbackLabel(record = {}) {
  const repaired = repairReferenceSpeciesRecord(record);
  return titleCaseWords(repaired.common_name || repaired.scientific_name || "Espece de reference");
}
