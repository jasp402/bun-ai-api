export type NewsSourceKind = "api" | "rss" | "atom" | "site";

export type NewsSourceCategory =
  | "general-tech"
  | "qa-testing"
  | "engineering"
  | "cloud"
  | "releases"
  | "community";

export type NewsSource = {
  name: string;
  url: string;
  kind: NewsSourceKind;
  category: NewsSourceCategory;
  tags: string[];
};

const rawNewsSources: NewsSource[] = [
  {
    name: "GDELT Project",
    url: "https://www.gdeltproject.org",
    kind: "site",
    category: "general-tech",
    tags: ["news", "monitoring", "global"],
  },
  {
    name: "NewsAPI",
    url: "https://newsapi.org/",
    kind: "api",
    category: "general-tech",
    tags: ["news", "api"],
  },
  {
    name: "The News API",
    url: "https://www.thenewsapi.com/",
    kind: "api",
    category: "general-tech",
    tags: ["news", "api"],
  },
  {
    name: "Mediastack",
    url: "https://mediastack.com/",
    kind: "api",
    category: "general-tech",
    tags: ["news", "api"],
  },
  {
    name: "New York Times Developer",
    url: "https://developer.nytimes.com/",
    kind: "api",
    category: "general-tech",
    tags: ["news", "api", "media"],
  },
  {
    name: "The Guardian Open Platform",
    url: "https://open-platform.theguardian.com/",
    kind: "api",
    category: "general-tech",
    tags: ["news", "api", "media"],
  },
  {
    name: "Alpha Vantage",
    url: "https://www.alphavantage.co/documentation/",
    kind: "api",
    category: "general-tech",
    tags: ["finance", "market", "api"],
  },
  {
    name: "RapidAPI News APIs",
    url: "https://rapidapi.com/collection/news-apis",
    kind: "site",
    category: "general-tech",
    tags: ["news", "api", "catalog"],
  },
  {
    name: "HNRSS Frontpage",
    url: "https://hnrss.org/frontpage",
    kind: "rss",
    category: "community",
    tags: ["hacker-news", "startup", "tech"],
  },
  {
    name: "Reddit Technology",
    url: "https://www.reddit.com/r/technology/.rss",
    kind: "rss",
    category: "community",
    tags: ["reddit", "technology"],
  },
  {
    name: "Reddit Programming",
    url: "https://www.reddit.com/r/programming/.rss",
    kind: "rss",
    category: "community",
    tags: ["reddit", "programming"],
  },
  {
    name: "Reddit QualityAssurance",
    url: "https://www.reddit.com/r/QualityAssurance/.rss",
    kind: "rss",
    category: "qa-testing",
    tags: ["reddit", "qa", "testing"],
  },
  {
    name: "dev.to Testing",
    url: "https://dev.to/feed/tag/testing",
    kind: "rss",
    category: "qa-testing",
    tags: ["dev.to", "testing"],
  },
  {
    name: "dev.to QA",
    url: "https://dev.to/feed/tag/qa",
    kind: "rss",
    category: "qa-testing",
    tags: ["dev.to", "qa"],
  },
  {
    name: "dev.to Automation",
    url: "https://dev.to/feed/tag/automation",
    kind: "rss",
    category: "qa-testing",
    tags: ["dev.to", "automation"],
  },
  {
    name: "Medium Software Testing",
    url: "https://medium.com/feed/tag/software-testing",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "testing"],
  },
  {
    name: "Medium Quality Assurance",
    url: "https://medium.com/feed/tag/quality-assurance",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "qa"],
  },
  {
    name: "Medium Test Automation",
    url: "https://medium.com/feed/tag/test-automation",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "automation"],
  },
  {
    name: "Medium Cypress",
    url: "https://medium.com/feed/tag/cypress",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "cypress"],
  },
  {
    name: "Medium Playwright",
    url: "https://medium.com/feed/tag/playwright",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "playwright"],
  },
  {
    name: "Medium Selenium",
    url: "https://medium.com/feed/tag/selenium",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "selenium"],
  },
  {
    name: "Medium Karate Testing",
    url: "https://medium.com/feed/tag/karate-testing",
    kind: "rss",
    category: "qa-testing",
    tags: ["medium", "karate"],
  },
  {
    name: "Cypress Blog RSS",
    url: "https://blog.cypress.io/rss/",
    kind: "rss",
    category: "qa-testing",
    tags: ["cypress", "blog"],
  },
  {
    name: "Cypress Docs RSS",
    url: "https://docs.cypress.io/rss.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["cypress", "docs"],
  },
  {
    name: "Cypress Site Blog RSS",
    url: "https://www.cypress.io/blog/rss.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["cypress", "blog"],
  },
  {
    name: "Playwright Feed",
    url: "https://playwright.dev/feed.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["playwright", "blog"],
  },
  {
    name: "Selenium Blog Feed",
    url: "https://www.selenium.dev/blog/feed.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["selenium", "blog"],
  },
  {
    name: "Appium Feed",
    url: "https://appium.io/feed.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["appium", "mobile"],
  },
  {
    name: "JMeter Feed",
    url: "https://jmeter.apache.org/feed.xml",
    kind: "rss",
    category: "qa-testing",
    tags: ["jmeter", "performance"],
  },
  {
    name: "Postman RSS",
    url: "https://www.postman.com/rss.xml",
    kind: "rss",
    category: "engineering",
    tags: ["postman", "api"],
  },
  {
    name: "CircleCI Blog RSS",
    url: "https://circleci.com/blog/rss/",
    kind: "rss",
    category: "engineering",
    tags: ["ci-cd", "circleci"],
  },
  {
    name: "GitHub Blog Feed",
    url: "https://github.blog/feed/",
    kind: "rss",
    category: "engineering",
    tags: ["github", "engineering"],
  },
  {
    name: "Atlassian Blog RSS",
    url: "https://www.atlassian.com/blog/rss.xml",
    kind: "rss",
    category: "engineering",
    tags: ["atlassian", "engineering"],
  },
  {
    name: "Meta Engineering Feed",
    url: "https://engineering.fb.com/feed/",
    kind: "rss",
    category: "engineering",
    tags: ["meta", "engineering"],
  },
  {
    name: "Netflix TechBlog Feed",
    url: "https://netflixtechblog.com/feed",
    kind: "rss",
    category: "engineering",
    tags: ["netflix", "engineering"],
  },
  {
    name: "AWS News Blog Feed",
    url: "https://aws.amazon.com/blogs/aws/feed/",
    kind: "rss",
    category: "cloud",
    tags: ["aws", "cloud"],
  },
  {
    name: "Google Cloud Blog Feed",
    url: "https://cloud.google.com/feeds/cloudblog.xml",
    kind: "rss",
    category: "cloud",
    tags: ["gcp", "cloud"],
  },
  {
    name: "Azure Blog Feed",
    url: "https://azure.microsoft.com/en-us/blog/feed/",
    kind: "rss",
    category: "cloud",
    tags: ["azure", "cloud"],
  },
  {
    name: "Playwright Releases",
    url: "https://github.com/microsoft/playwright/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "playwright", "releases"],
  },
  {
    name: "Playwright Issues",
    url: "https://github.com/microsoft/playwright/issues.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "playwright", "issues"],
  },
  {
    name: "Cypress Releases",
    url: "https://github.com/cypress-io/cypress/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "cypress", "releases"],
  },
  {
    name: "Selenium Releases",
    url: "https://github.com/SeleniumHQ/selenium/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "selenium", "releases"],
  },
  {
    name: "Selenium Issues",
    url: "https://github.com/SeleniumHQ/selenium/issues.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "selenium", "issues"],
  },
  {
    name: "Appium Releases",
    url: "https://github.com/appium/appium/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "appium", "releases"],
  },
  {
    name: "Apache JMeter Releases",
    url: "https://github.com/apache/jmeter/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "jmeter", "releases"],
  },
  {
    name: "Karate Releases",
    url: "https://github.com/karatelabs/karate/releases.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "karate", "releases"],
  },
  {
    name: "Karate Issues",
    url: "https://github.com/karatelabs/karate/issues.atom",
    kind: "atom",
    category: "releases",
    tags: ["github", "karate", "issues"],
  },
];

const dedupedNewsSources = Array.from(
  new Map(rawNewsSources.map((source) => [source.url, source])).values()
);

export const newsSources = dedupedNewsSources;

export function getNewsSourcesByCategory(category: NewsSourceCategory) {
  return newsSources.filter((source) => source.category === category);
}

export function getNewsSourcesByKind(kind: NewsSourceKind) {
  return newsSources.filter((source) => source.kind === kind);
}

export function searchNewsSources(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return newsSources;
  }

  return newsSources.filter((source) => {
    const haystack = [
      source.name,
      source.url,
      source.kind,
      source.category,
      ...source.tags,
    ].join(" ").toLowerCase();

    return haystack.includes(normalized);
  });
}

export function summarizeNewsSources() {
  const counts = newsSources.reduce<Record<string, number>>((acc, source) => {
    acc[source.kind] = (acc[source.kind] || 0) + 1;
    return acc;
  }, {});

  return {
    total: newsSources.length,
    byKind: counts,
  };
}
