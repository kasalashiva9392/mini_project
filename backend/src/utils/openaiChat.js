const OpenAI = require("openai");
const env = require("../config/env");

let client;

function getOllamaBaseUrl() {
  const u = env.OLLAMA_BASE_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

function getOpenAI() {
  if (!env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

/** True if Ollama or OpenAI is configured. */
function isLLMConfigured() {
  return !!(getOllamaBaseUrl() || env.OPENAI_API_KEY);
}

/**
 * @param {string} baseUrl
 * @param {{ system: string; user: string; maxTokens?: number }} opts
 */
async function ollamaChatCompletion(baseUrl, opts) {
  const model = env.OLLAMA_MODEL || "llama3.2";
  const maxTokens = opts.maxTokens ?? 1024;

  let res;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        stream: false,
        options: {
          temperature: 0.5,
          num_predict: maxTokens,
        },
      }),
    });
  } catch (e) {
    const err = new Error(
      `Cannot reach Ollama at ${baseUrl}. Install: https://ollama.com — then run: ollama pull ${model}`,
    );
    err.status = 503;
    err.cause = e;
    throw err;
  }

  const rawText = await res.text();
  if (!res.ok) {
    const err = new Error(
      res.status === 404
        ? `Ollama model may be missing. Run: ollama pull ${model}`
        : `Ollama error (${res.status}): ${rawText.slice(0, 300)}`,
    );
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    const err = new Error("Invalid JSON from Ollama");
    err.status = 502;
    throw err;
  }

  const text = data.message?.content?.trim();
  if (!text) {
    const err = new Error("Empty response from Ollama");
    err.status = 502;
    throw err;
  }
  return { text, model: data.model || model };
}

/**
 * Map OpenAI SDK errors to shorter, user-facing messages.
 */
function normalizeOpenAIError(err) {
  if (!err || typeof err.status !== "number") {
    return err;
  }
  const status = err.status;
  const code = err.code || err.error?.code;
  const out = new Error();
  out.status = status;

  const ollamaHint =
    " For a free local LLM: install Ollama, `ollama pull llama3.2`, set OLLAMA_BASE_URL=http://127.0.0.1:11434, clear OPENAI_API_KEY, restart the API.";

  if (status === 429) {
    if (code === "insufficient_quota" || code === "billing_not_active") {
      out.message =
        "OpenAI quota or billing issue: add credits at platform.openai.com/account/billing — or switch to local Ollama (no API cost)." +
        ollamaHint;
    } else if (code === "rate_limit_exceeded") {
      out.message =
        "OpenAI rate limit: wait and retry, or use local Ollama instead (see backend .env: OLLAMA_BASE_URL)." + ollamaHint;
    } else {
      out.message =
        "OpenAI limit reached (quota/rate). Check billing or wait — or use Ollama locally." + ollamaHint;
    }
    return out;
  }
  if (status === 401) {
    out.message =
      "Invalid OpenAI API key. Set OPENAI_API_KEY in backend .env (platform.openai.com/api-keys).";
    return out;
  }
  if (status === 403) {
    out.message = "OpenAI denied this request. Check API key access and project billing.";
    return out;
  }

  out.message = err.message || "OpenAI request failed";
  return out;
}

/**
 * @param {{ system: string; user: string; maxTokens?: number }} opts
 * @returns {Promise<{ text: string; model: string }>}
 */
async function chatCompletion(opts) {
  const ollamaBase = getOllamaBaseUrl();
  if (ollamaBase) {
    return ollamaChatCompletion(ollamaBase, opts);
  }

  const openai = getOpenAI();
  if (!openai) {
    const err = new Error(
      "No LLM configured. Set OLLAMA_BASE_URL (e.g. http://127.0.0.1:11434) or OPENAI_API_KEY in backend .env",
    );
    err.status = 503;
    throw err;
  }
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0.5,
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      const err = new Error("Empty response from OpenAI");
      err.status = 502;
      throw err;
    }
    return { text, model };
  } catch (e) {
    const mapped = normalizeOpenAIError(e);
    if (mapped !== e) throw mapped;
    throw e;
  }
}

module.exports = { getOpenAI, isLLMConfigured, chatCompletion };
