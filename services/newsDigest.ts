import { braveSearchService } from "./braveSearch";
import {
  getNewsSourcesByCategory,
  newsSources,
  searchNewsSources,
  type NewsSource,
} from "./newsSources";

type FeedEntry = {
  title: string;
  url: string;
  summary: string;
  sourceName: string;
  publishedAt: string | null;
};

type DigestItem = FeedEntry & {
  origin: "feed" | "brave";
};

type DigestCacheEntry = {
  createdAt: string;
  query: string;
  items: DigestItem[];
};

type PreparedNewsContext =
  | {
      mode: "digest";
      directReply: string;
      items: DigestItem[];
    }
  | {
      mode: "detail";
      selectedIndex: number;
      selectedItem: DigestItem;
      extraSystemContext: string;
    }
  | null;

const FEED_TIMEOUT_MS = 10000;
const DIGEST_TTL_MS = 30 * 60 * 1000;
const MAX_SOURCES_TO_SCAN = 10;
const MAX_ITEMS_PER_FEED = 3;
const digestCache = new Map<string, DigestCacheEntry>();

export const newsDigestService = {
  async prepareContext(chatId: string, query: string): Promise<PreparedNewsContext> {
    const detailIndex = extractDetailIndex(query);
    if (detailIndex != null) {
      const detailContext = await buildDetailContext(chatId, detailIndex);
      if (detailContext) {
        return detailContext;
      }
    }

    if (!shouldBuildDigest(query)) {
      return null;
    }

    const items = await buildDigestItems(query, 10);
    if (items.length === 0) {
      return null;
    }

    digestCache.set(chatId, {
      createdAt: new Date().toISOString(),
      query,
      items,
    });

    return {
      mode: "digest",
      directReply: formatDigestReply(query, items),
      items,
    };
  },
};

async function buildDetailContext(chatId: string, requestedIndex: number): Promise<PreparedNewsContext> {
  const cached = digestCache.get(chatId);
  if (!cached) {
    return null;
  }

  const ageMs = Date.now() - new Date(cached.createdAt).getTime();
  if (ageMs > DIGEST_TTL_MS) {
    digestCache.delete(chatId);
    return null;
  }

  const selectedItem = cached.items[requestedIndex - 1];
  if (!selectedItem) {
    return null;
  }

  let braveContext: string | null = null;
  try {
    braveContext = await braveSearchService.buildRecentContext(selectedItem.title);
  } catch (error) {
    console.error("[NewsDigest] Brave Search detail enrichment failed:", error);
  }

  const extraSystemContext = [
    "=== CONTEXTO DE NOTICIA SELECCIONADA ===",
    `Indice pedido: ${requestedIndex}`,
    `Consulta original: ${cached.query}`,
    `Titulo: ${selectedItem.title}`,
    `Fuente: ${selectedItem.sourceName}`,
    `URL: ${selectedItem.url}`,
    selectedItem.publishedAt ? `Publicado: ${selectedItem.publishedAt}` : "",
    selectedItem.summary ? `Resumen base: ${selectedItem.summary}` : "",
    braveContext,
    "El usuario pidió profundizar en este punto concreto del boletín previo. Explica qué significa, por qué importa y qué se puede vigilar después, sin inventar datos.",
  ].filter(Boolean).join("\n");

  return {
    mode: "detail",
    selectedIndex: requestedIndex,
    selectedItem,
    extraSystemContext,
  };
}

async function buildDigestItems(query: string, limit: number): Promise<DigestItem[]> {
  const sourceCandidates = pickSourcesForQuery(query).slice(0, MAX_SOURCES_TO_SCAN);
  const feedResults = await Promise.allSettled(sourceCandidates.map((source) => fetchFeedEntries(source)));
  const feedItems = feedResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .map((entry) => ({ ...entry, origin: "feed" as const }));

  let braveItems: DigestItem[] = [];
  if (braveSearchService.isEnabled() && braveSearchService.shouldSearch(query)) {
    try {
      const braveResults = await braveSearchService.searchRecentWeb(query, 5);
      braveItems = braveResults.map((item) => ({
        title: item.title,
        url: item.url,
        summary: [item.description, ...(item.extraSnippets || [])].filter(Boolean).join(" ").trim(),
        sourceName: "Brave Search",
        publishedAt: item.age || null,
        origin: "brave" as const,
      }));
    } catch (error) {
      console.error("[NewsDigest] Brave Search digest enrichment failed:", error);
    }
  }

  const deduped = dedupeItems([...braveItems, ...feedItems]);
  deduped.sort((left, right) => compareDigestItems(query, left, right));
  return deduped.slice(0, limit);
}

function pickSourcesForQuery(query: string): NewsSource[] {
  const normalized = query.trim().toLowerCase();
  const directMatches = searchNewsSources(normalized).filter((source) => source.kind !== "api" && source.kind !== "site");
  if (directMatches.length >= 5) {
    return directMatches;
  }

  const selected: NewsSource[] = [];
  const add = (items: NewsSource[]) => {
    for (const item of items) {
      if (item.kind === "api" || item.kind === "site") {
        continue;
      }
      if (!selected.some((existing) => existing.url === item.url)) {
        selected.push(item);
      }
    }
  };

  const isQaQuery = /(qa|testing|test automation|automatiz|playwright|cypress|selenium|appium|karate|jmeter|postman)/i.test(normalized);
  const isCloudQuery = /(aws|azure|gcp|google cloud|cloud|devops|ci|cd|circleci)/i.test(normalized);

  if (isQaQuery) {
    add(getNewsSourcesByCategory("qa-testing"));
    add(getNewsSourcesByCategory("releases"));
    add(getNewsSourcesByCategory("engineering"));
  } else if (isCloudQuery) {
    add(getNewsSourcesByCategory("cloud"));
    add(getNewsSourcesByCategory("engineering"));
    add(getNewsSourcesByCategory("community"));
  } else {
    add(getNewsSourcesByCategory("community"));
    add(getNewsSourcesByCategory("engineering"));
    add(getNewsSourcesByCategory("releases"));
    add(getNewsSourcesByCategory("cloud"));
  }

  if (directMatches.length > 0) {
    add(directMatches);
  }

  return selected.length > 0 ? selected : newsSources.filter((source) => source.kind === "rss" || source.kind === "atom");
}

async function fetchFeedEntries(source: NewsSource): Promise<FeedEntry[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "bun-ai-api/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseFeed(xml, source).slice(0, MAX_ITEMS_PER_FEED);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeed(xml: string, source: NewsSource): FeedEntry[] {
  const normalizedXml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const entryBlocks = [
    ...matchBlocks(normalizedXml, "item"),
    ...matchBlocks(normalizedXml, "entry"),
  ];

  return entryBlocks
    .map((block) => parseEntryBlock(block, source))
    .filter((entry): entry is FeedEntry => Boolean(entry && entry.title && entry.url));
}

function parseEntryBlock(block: string, source: NewsSource): FeedEntry | null {
  const title = decodeEntities(extractTag(block, "title")).trim();
  const summary = decodeEntities(
    extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content")
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const linkFromTag = extractTag(block, "link");
  const linkFromHref = extractAttr(block, "link", "href");
  const url = (linkFromHref || linkFromTag || "").trim();
  const publishedAt = (
    extractTag(block, "pubDate") ||
    extractTag(block, "published") ||
    extractTag(block, "updated")
  ).trim() || null;

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
    summary,
    sourceName: source.name,
    publishedAt,
  };
}

function matchBlocks(xml: string, tagName: string) {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...xml.matchAll(regex)].map((match) => match[1] || "");
}

function extractTag(block: string, tagName: string) {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match?.[1] || "";
}

function extractAttr(block: string, tagName: string, attrName: string) {
  const regex = new RegExp(`<${tagName}\\b[^>]*\\s${attrName}="([^"]+)"[^>]*\\/?>`, "i");
  const match = block.match(regex);
  return match?.[1] || "";
}

function dedupeItems(items: DigestItem[]) {
  const seen = new Set<string>();
  const deduped: DigestItem[] = [];

  for (const item of items) {
    const key = `${item.url.toLowerCase()}|${item.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function compareDigestItems(query: string, a: DigestItem, b: DigestItem) {
  const scoreDiff = scoreDigestItem(query, b) - scoreDigestItem(query, a);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return compareDigestItemsByDate(a, b);
}

function compareDigestItemsByDate(a: DigestItem, b: DigestItem) {
  const aTime = parseDateValue(a.publishedAt);
  const bTime = parseDateValue(b.publishedAt);
  return bTime - aTime;
}

function scoreDigestItem(query: string, item: DigestItem) {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = `${item.title} ${item.summary} ${item.sourceName}`.toLowerCase();
  const keywords = normalizedQuery
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((token) => token.length >= 2);

  let score = item.origin === "brave" ? 12 : 0;
  if (/(ia|inteligencia artificial|openai|anthropic|claude|gemini|gpt|mistral|xai|grok|llm|modelo|agente|mcp)/i.test(normalizedQuery)) {
    score += item.origin === "brave" ? 10 : 0;
  }

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 4;
    }
  }

  if (item.sourceName === "Brave Search") {
    score += 3;
  }

  if (item.sourceName.includes("GitHub") || item.sourceName.includes("Playwright") || item.sourceName.includes("Cypress")) {
    score += 1;
  }

  return score;
}

function parseDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const relative = value.match(/(\d+)\s+(minute|minutes|hour|hours|day|days)/i);
  if (relative) {
    const amount = Number(relative[1] || 0);
    const unit = (relative[2] || "").toLowerCase();
    const multipliers: Record<string, number> = {
      minute: 60_000,
      minutes: 60_000,
      hour: 3_600_000,
      hours: 3_600_000,
      day: 86_400_000,
      days: 86_400_000,
    };
    return Date.now() - amount * (multipliers[unit] || 0);
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldBuildDigest(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const blockedIntents = [
    /todos los d[ií]as/i,
    /cada d[ií]a/i,
    /a las \d+/i,
    /quiero que me env[ií]es/i,
    /env[ií]ame/i,
    /recu[eé]rdame/i,
    /recordatorio/i,
    /agenda/i,
    /programa/i,
    /suscr/i,
  ];

  if (blockedIntents.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const normalizedLoose = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])\1+/g, "$1");

  const explicitDigestIntents = [
    /(?:dame|pasame|p[aá]same|muestrame|mu[eé]strame|quiero ver)\s+(?:las\s+)?(?:\d+\s+)?(?:[uú]ltimas\s+)?(?:noticias|novedades|titulares)/i,
    /(?:qu[eé]|que)\s+sal[ií]o/i,
    /(?:resumen|top)\s+(?:de\s+)?(?:noticias|novedades|titulares)/i,
    /(?:noticias|novedades|titulares)\s+(?:de\s+)?(?:hoy|recientes|de la semana|de esta semana)/i,
    /(?:actualidad|noticias)\s+(?:sobre|de)\s+/i,
    /(?:ponme|ponerme|ponernos|pon|poner)\s+al\s+d[ií]a/i,
  ];

  if (explicitDigestIntents.some((pattern) => pattern.test(normalized) || pattern.test(normalizedLoose))) {
    return true;
  }

  const hasNewsLikeTerm = /(notic|novedad|titular|actualidad)/i.test(normalizedLoose);
  const hasAiLikeTerm = /\bia\b|inteligencia artificial|openai|anthropic|claude|gemini|gpt|llm|modelo/i.test(normalizedLoose);
  const asksToCatchUp = /ponerme al dia|ponme al dia|al dia/i.test(normalizedLoose);

  return hasNewsLikeTerm && (hasAiLikeTerm || asksToCatchUp);
}

function extractDetailIndex(query: string) {
  const match = query.match(/(?:profundiza|profundizar|amplia|amplía|amplie|detalle|expande|explicar|más sobre|mas sobre).{0,25}?(?:n[uú]mero|numero|nro|#)?\s*(\d{1,2})/i);
  if (!match?.[1]) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1 || value > 20) {
    return null;
  }

  return value;
}

function formatDigestReply(query: string, items: DigestItem[]) {
  const lines = items.slice(0, 10).map((item, index) => {
    const meta = [item.sourceName, item.publishedAt].filter(Boolean).join(" | ");
    return `${index + 1}. ${item.title}${meta ? ` (${meta})` : ""}`;
  });

  return [
    `Te comparto 10 titulares recientes sobre: ${query}`,
    ...lines,
    "Si quieres, dime: profundiza en la número 5.",
  ].join("\n");
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
