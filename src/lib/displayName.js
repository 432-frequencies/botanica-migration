const DISPLAY_NAME_MAX_LENGTH = 24;

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function sanitizeDisplayName(value) {
  return normalizeWhitespace(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function fallbackDisplayName(email, fallback = "Agent W1LD") {
  const localPart = String(email || "").split("@")[0] || "";
  const prettified = titleCase(localPart);
  return sanitizeDisplayName(prettified) || fallback;
}

export function resolveDisplayName({ displayName = "", fullName = "", email = "", fallback = "Agent W1LD" } = {}) {
  const explicitName = sanitizeDisplayName(displayName);
  if (explicitName) return explicitName;

  const explicitFullName = sanitizeDisplayName(fullName);
  if (explicitFullName) return explicitFullName;

  return fallbackDisplayName(email, fallback);
}

export function isValidPublicDisplayName(value) {
  return sanitizeDisplayName(value).length >= 3;
}

export function getDisplayNameInitial(value, email = "") {
  const label = resolveDisplayName({ displayName: value, email });
  return label?.charAt(0)?.toUpperCase() || "?";
}
