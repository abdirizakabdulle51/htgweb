import "dotenv/config";

const CRM_CONTEXT_URL = "https://crm-api.102-203-134-106.sslip.io/ai-recs/context";
const CRM_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/ai-recs/sync";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5.4-nano";
const AI_RECS_REQUEST_TIMEOUT_MS = 30000;
const MAX_COMPANIES_PER_RUN = 200;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_RECS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${AI_RECS_REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function priorityRank(priority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  if (priority === "low") return 2;
  return 3;
}

function recommendedTopPriority(recommendations) {
  const [first] = [...recommendations].sort(
    (a, b) => priorityRank(a?.priority) - priorityRank(b?.priority)
  );
  return first?.rule || first?.recommendedService || null;
}

function groupCompanyContexts(companies) {
  const companiesById = new Map();

  for (const company of companies) {
    if (!company?.companyId) continue;

    const existing = companiesById.get(company.companyId);
    if (existing) {
      existing.recommendations.push(...(company.recommendations || []));
      existing.usageSummary = existing.usageSummary || company.usageSummary;
      existing.manageOneTenants.push(...(company.manageOneTenants || []));
    } else {
      companiesById.set(company.companyId, {
        ...company,
        recommendations: [...(company.recommendations || [])],
        manageOneTenants: [...(company.manageOneTenants || [])]
      });
    }
  }

  return [...companiesById.values()].filter((company) => company.recommendations.length > 0);
}

function compactCompanyContext(company) {
  return {
    companyId: company.companyId,
    companyName: company.companyName,
    sectorName: company.sectorName || null,
    recommendations: company.recommendations.map((recommendation) => ({
      rule: recommendation.rule,
      priority: recommendation.priority,
      triggerReason: recommendation.triggerReason,
      recommendedService: recommendation.recommendedService,
      estimatedValue: recommendation.estimatedValue
    })),
    usageSummary: company.usageSummary || {},
    manageOneTenants: (company.manageOneTenants || []).map((tenant) => ({
      name: tenant.name,
      ecsUsed: tenant.ecsUsed,
      evsUsed: tenant.evsUsed,
      projectCount: tenant.projectCount,
      resources: tenant.resources || []
    }))
  };
}

function buildPrompt(company) {
  const topPriorityOptions = company.recommendations
    .map((recommendation) => recommendation.rule || recommendation.recommendedService)
    .filter(Boolean);
  const context = compactCompanyContext(company);

  return `Write a short, sales-usable cloud account recommendation narrative.

Requirements:
- Use 2 to 4 sentences.
- Tailor it to the company, sector, triggered rules, trigger reasons, services, spend/usage, and ManageOne context provided.
- Suggest what the account team should prioritize first.
- Pick exactly one topPriority from this allowed list: ${JSON.stringify(topPriorityOptions)}.
- Do not invent a recommendation, product, issue, or topPriority that is not in the input.
- Return only JSON with this shape: {"narrative":"...","topPriority":"..."}.

Company context:
${JSON.stringify(context, null, 2)}`;
}

function extractOpenAiText(body) {
  if (typeof body?.output_text === "string") return body.output_text;

  const output = Array.isArray(body?.output) ? body.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") return part.text;
    }
  }

  return "";
}

function normalizeGeneratedRecommendation(company, body) {
  const text = extractOpenAiText(body);
  const parsed = parseJson(text, `OpenAI response for ${company.companyName || company.companyId}`);
  if (!isRecord(parsed)) {
    throw new Error("OpenAI response JSON must be an object");
  }

  const narrative = typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
  const proposedTopPriority = typeof parsed.topPriority === "string" ? parsed.topPriority.trim() : "";
  if (!narrative) {
    throw new Error("OpenAI response did not include narrative");
  }

  const allowedTopPriorities = new Set(
    company.recommendations
      .map((recommendation) => recommendation.rule || recommendation.recommendedService)
      .filter(Boolean)
  );
  const topPriority = allowedTopPriorities.has(proposedTopPriority)
    ? proposedTopPriority
    : recommendedTopPriority(company.recommendations);

  return {
    companyId: company.companyId,
    narrative,
    ...(topPriority ? { topPriority } : {}),
    model: OPENAI_MODEL,
    generatedAt: Date.now()
  };
}

async function fetchRecommendationContext(syncSecret) {
  const { response, text } = await fetchTextWithTimeout(CRM_CONTEXT_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    }
  });

  const body = parseJson(text, "CRM context response");
  if (!response.ok || body.success !== true || !Array.isArray(body.companies)) {
    throw new Error(`CRM context fetch failed: HTTP ${response.status} ${text}`);
  }

  return body.companies;
}

async function generateRecommendation(company, openAiKey) {
  const { response, text } = await fetchTextWithTimeout(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "You write concise B2B cloud sales recommendations. You must use only the recommendation options and facts provided by the user."
        },
        {
          role: "user",
          content: buildPrompt(company)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ai_recommendation_narrative",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              narrative: { type: "string" },
              topPriority: { type: "string" }
            },
            required: ["narrative", "topPriority"]
          }
        }
      }
    })
  });

  const body = parseJson(text, `OpenAI response for ${company.companyName || company.companyId}`);
  if (!response.ok) {
    throw new Error(`OpenAI request failed: HTTP ${response.status} ${text}`);
  }

  return normalizeGeneratedRecommendation(company, body);
}

async function pushRecommendationsToCrm(items, syncSecret) {
  const { response, text } = await fetchTextWithTimeout(CRM_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(items)
  });

  const body = parseJson(text, "CRM AI recommendations sync response");
  if (!response.ok || body.success !== true) {
    throw new Error(`CRM AI recommendations sync failed: HTTP ${response.status} ${text}`);
  }

  return body;
}

async function generateAiRecommendations() {
  const syncSecret = requireEnv("AI_RECS_SYNC_SECRET");
  const openAiKey = requireEnv("OPENAI_API_KEY");
  const failedCompanies = [];
  let openAiCalls = 0;

  const contexts = groupCompanyContexts(await fetchRecommendationContext(syncSecret));
  const companies = contexts.slice(0, MAX_COMPANIES_PER_RUN);
  if (contexts.length > MAX_COMPANIES_PER_RUN) {
    console.warn(
      `[AI RECS] company cap applied: ${contexts.length} eligible company(s), processing first ${MAX_COMPANIES_PER_RUN}`
    );
  }

  console.log(`[AI RECS] context fetched: ${contexts.length} eligible company(s), processing ${companies.length}`);

  const results = [];
  for (let index = 0; index < companies.length; index += 1) {
    const company = companies[index];
    const companyName = company.companyName || company.companyId;
    console.log(`[AI RECS] generating recommendation for company ${index + 1}/${companies.length}: ${companyName}`);

    try {
      openAiCalls += 1;
      results.push(await generateRecommendation(company, openAiKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      failedCompanies.push({ companyId: company.companyId, companyName, error: message });
      console.error(`[AI RECS] generation skipped for ${companyName}: ${message}`);
    }
  }

  let crmSynced = 0;
  if (results.length > 0) {
    const syncResult = await pushRecommendationsToCrm(results, syncSecret);
    crmSynced = syncResult.count ?? results.length;
  } else {
    console.warn("[AI RECS] CRM sync skipped: no narratives generated");
  }

  console.log(
    `[AI RECS] complete: companiesProcessed=${companies.length} openAiCalls=${openAiCalls} generated=${results.length} crmSynced=${crmSynced} failed=${failedCompanies.length}`
  );
  if (failedCompanies.length > 0) {
    console.warn(`[AI RECS] failed companies: ${JSON.stringify(failedCompanies)}`);
  }
}

generateAiRecommendations().catch((error) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error("[AI RECS] failed:", message);
  process.exitCode = 1;
});
