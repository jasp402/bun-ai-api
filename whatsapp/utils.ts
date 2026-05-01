export function isTruthyEnv(value: string | undefined, defaultValue = false) {
  if (value == null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function normalizeWhatsAppId(value: string) {
  if (value.includes("@")) {
    return value;
  }

  const digits = value.replace(/[^\d-]/g, "");
  if (digits.includes("-")) {
    return `${digits}@g.us`;
  }

  return `${digits}@c.us`;
}

export function chatIdToString(value: string | { _serialized?: string; user?: string; server?: string }) {
  if (typeof value === "string") {
    return value;
  }

  if (value._serialized) {
    return value._serialized;
  }

  if (value.user && value.server) {
    return `${value.user}@${value.server}`;
  }

  return "";
}

export function matchesGroupTrigger(text: string, rawTriggers: string | undefined) {
  const triggers = (rawTriggers || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (triggers.length === 0) {
    return false;
  }

  const lower = text.toLowerCase();
  return triggers.some((trigger) => lower.includes(trigger));
}

export function matchesRequiredPrefix(text: string, prefix: string | undefined) {
  const normalizedPrefix = (prefix || "").trim().toLowerCase();
  if (!normalizedPrefix) {
    return true;
  }

  const normalizedText = text.trim().toLowerCase();
  const escapedPrefix = escapeRegExp(normalizedPrefix);
  const pattern = new RegExp(`(^|\\s)${escapedPrefix}(?=\\s|$|[.!?,:;])`, "i");
  return pattern.test(normalizedText);
}

export function stripRequiredPrefix(text: string, prefix: string | undefined) {
  const normalizedPrefix = (prefix || "").trim();
  if (!normalizedPrefix) {
    return text.trim();
  }

  const trimmed = text.trim();
  const escapedPrefix = escapeRegExp(normalizedPrefix);
  const pattern = new RegExp(`(^|\\s)${escapedPrefix}(?=\\s|$|[.!?,:;])`, "i");

  if (!pattern.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

export function parseAllowedWhatsAppIds(rawValue: string | undefined) {
  return new Set(
    (rawValue || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => normalizeAllowedToken(entry))
      .filter(Boolean)
  );
}

export function isAllowedWhatsAppId(candidate: string | undefined, allowedIds: Set<string>) {
  if (!candidate || allowedIds.size === 0) {
    return false;
  }

  const normalized = normalizeAllowedToken(candidate);
  if (!normalized) {
    return false;
  }

  return allowedIds.has(normalized);
}

export function isAllowedWhatsAppChat(chatId: string | undefined, allowedChatIds: Set<string>) {
  if (!chatId || allowedChatIds.size === 0) {
    return false;
  }

  return allowedChatIds.has(chatId.trim().toLowerCase());
}

function normalizeAllowedToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase().replace(/:\d+(?=@)/g, "");
  }

  return trimmed.replace(/\D/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeOutgoingText(text: string) {
  return text
    .replace(/<pre>/g, "```")
    .replace(/<\/pre>/g, "```")
    .replace(/<code>/g, "`")
    .replace(/<\/code>/g, "`")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function addRobotSignature(text: string) {
  const clean = text.trim();
  if (!clean) {
    return "🤖";
  }

  if (clean.startsWith("🤖")) {
    return clean;
  }

  return `🤖 ${clean}`;
}
