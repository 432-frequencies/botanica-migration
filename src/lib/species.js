const VALID_CATEGORIES = new Set([
  "plant",
  "tree",
  "bird",
  "fungus",
  "rock",
  "insect",
  "arachnid",
]);

const TREE_PATTERN = /\b(arbre|tree|woody|ligneux|ch[êe]ne|oak|quercus|pin|pinus|sapin|fir|abies|c[èe]dre|cedar|cedrus|cypr[eè]s|cypress|érable|erable|acer|bouleau|betula|peuplier|populus|saule|salix|fr[êe]ne|fraxinus|orme|ulmus|aulne|alnus|magnolia|pommier|malus|poirier|pyrus|prunus|cerisier|prunier|platane|platanus|marronnier|tilleul|tilia|eucalyptus|acacia|robinia|taxus)\b/i;

const ARACHNID_PATTERN = /\b(araign[ée]e|araignee|spider|arachnid|épeire|epeire|argiope|saltique|saltic|lycose|wolf spider|thomise|crab spider|t[ée]g[ée]naire|tegenaria|tegenaire|pholcus|pholque|steatoda|araneus|eresus|tarentule|orb[- ]weaver|cross spider|jumping spider)\b/i;

const BIRD_PATTERN = /\b(oiseau|bird|avian|rapace|bec|plumage|aile|wing|feather|chant|perché|perched)\b/i;

const FUNGUS_PATTERN = /\b(champignon|fungus|mushroom|myc[eè]te|bolet|amanite|lichen|lichenized)\b/i;

const ROCK_PATTERN = /\b(min[ée]ral|mineral|roche|rock|pierre|stone|crystal|cristal|gem|gemme|granite|quartz|basalte|schiste)\b/i;

const INSECT_PATTERN = /\b(insecte|insect|bug|beetle|fly|mouche|fourmi|ant|abeille|bee|papillon|butterfly|moth|col[ée]opt[èe]re|scarab[ée]e|scarabee|libellule|dragonfly|grillon|cricket|sauterelle|grasshopper|coccinelle|ladybug)\b/i;

function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");
}

export function getSpeciesKey(record) {
  return (
    record?.scientific_name?.toLowerCase().trim() ||
    record?.common_name?.toLowerCase().trim() ||
    ""
  );
}

export function inferCategoryFromText(...parts) {
  const text = normalizeText(...parts);
  if (!text) return null;
  if (ARACHNID_PATTERN.test(text)) return "arachnid";
  if (TREE_PATTERN.test(text)) return "tree";
  if (BIRD_PATTERN.test(text)) return "bird";
  if (FUNGUS_PATTERN.test(text)) return "fungus";
  if (ROCK_PATTERN.test(text)) return "rock";
  if (INSECT_PATTERN.test(text)) return "insect";
  return null;
}

export function normalizeSpeciesCategory(category, record = {}) {
  const rawCategory = String(category || record.category || "").toLowerCase().trim();
  const inferred = inferCategoryFromText(
    record.common_name,
    record.scientific_name,
    record.family,
    record.description,
    record.habitat,
  );

  if (rawCategory === "insect" && inferred === "arachnid") return "arachnid";
  if (rawCategory === "plant" && inferred === "tree") return "tree";
  if (rawCategory === "plant" && inferred === "arachnid") return "arachnid";
  if (!VALID_CATEGORIES.has(rawCategory)) return inferred || "plant";

  return inferred || rawCategory;
}

export function normalizeSpeciesRecord(record) {
  if (!record) return record;
  const category = normalizeSpeciesCategory(record.category, record);
  if (category === record.category) return record;
  return { ...record, category };
}
