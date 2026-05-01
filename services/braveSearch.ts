type BraveSearchResult = {
  title: string;
  url: string;
  description: string;
  age?: string;
  extraSnippets?: string[];
};

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;
      extra_snippets?: string[];
    }>;
  };
};

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export const braveSearchService = {
  isEnabled: () => Boolean(process.env.BRAVE_SEARCH_API),

  shouldSearch: (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || normalized.length < 8) {
      return false;
    }

    const recencySignals = [
      "hoy",
      "ayer",
      "semana",
      "reciente",
      "recientes",
      "nuevo",
      "nueva",
      "nuevas",
      "nuevos",
      "último",
      "ultimos",
      "últimos",
      "ultimas",
      "últimas",
      "salió",
      "salio",
      "lanzamiento",
      "tendencia",
      "tendencias",
      "noticia",
      "noticias",
      "actualidad",
      "qué salió",
      "que salio",
      "qué pasó",
      "que paso",
    ];

    const aiSignals = [
      "ia",
      "inteligencia artificial",
      "openai",
      "anthropic",
      "claude",
      "gemini",
      "gpt",
      "mistral",
      "xai",
      "grok",
      "llm",
      "modelo",
      "modelos",
      "rag",
      "agente",
      "agentes",
      "mcp",
      "brave search",
    ];

    return recencySignals.some((token) => normalized.includes(token)) ||
      aiSignals.some((token) => normalized.includes(token));
  },

  searchRecentWeb: async (query: string, count = 5): Promise<BraveSearchResult[]> => {
    const apiKey = process.env.BRAVE_SEARCH_API;
    if (!apiKey) {
      throw new Error("BRAVE_SEARCH_API is not configured");
    }

    const url = new URL(BRAVE_SEARCH_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(Math.max(count, 1), 10)));
    url.searchParams.set("freshness", "pw");
    url.searchParams.set("search_lang", "es");
    url.searchParams.set("country", "ALL");
    url.searchParams.set("safesearch", "strict");
    url.searchParams.set("extra_snippets", "true");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave Search failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as BraveSearchResponse;
    const results = data.web?.results || [];

    return results
      .filter((result) => result.title && result.url)
      .map((result) => ({
        title: result.title || "",
        url: result.url || "",
        description: result.description || "",
        age: result.age,
        extraSnippets: result.extra_snippets?.slice(0, 3) || [],
      }));
  },

  buildRecentContext: async (query: string): Promise<string | null> => {
    if (!braveSearchService.isEnabled() || !braveSearchService.shouldSearch(query)) {
      return null;
    }

    const results = await braveSearchService.searchRecentWeb(query, 5);
    if (results.length === 0) {
      return null;
    }

    const lines = results.map((result, index) => {
      const extra = result.extraSnippets && result.extraSnippets.length > 0
        ? ` | snippets: ${result.extraSnippets.join(" || ")}`
        : "";
      const age = result.age ? ` | age: ${result.age}` : "";
      return `${index + 1}. ${result.title}${age}\nURL: ${result.url}\nResumen: ${result.description}${extra}`;
    });

    return [
      "=== CONTEXTO WEB RECIENTE (BRAVE SEARCH, max 7 dias) ===",
      `Consulta: ${query}`,
      ...lines,
      "Usa solo esta evidencia web reciente cuando hables de novedades, lanzamientos o noticias. Si la evidencia no alcanza, dilo con prudencia.",
    ].join("\n");
  },
};
