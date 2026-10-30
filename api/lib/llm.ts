import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AiMisconfigured, listModels } from "../ai-client";

/**
 * Cliente LLM no padrão OpenAI (chat/completions). Funciona com Gemini, OpenAI,
 * OpenRouter, Ollama etc. apenas trocando as variáveis de ambiente.
 *
 *   LLM_BASE_URL  ex.: https://generativelanguage.googleapis.com/v1beta/openai
 *   LLM_API_KEY   chave do provedor (somente servidor)
 *   LLM_MODEL     id do modelo; se vazio, usa o default do gateway Kimi
 *
 * Sem LLM_*, cai no gateway antigo (KIMI_AGENTGW_*).
 */
export async function getModel() {
  const baseURL = process.env.LLM_BASE_URL ?? process.env.KIMI_AGENTGW_BASE_URL;
  const apiKey = process.env.LLM_API_KEY ?? process.env.KIMI_AGENTGW_API_KEY;
  if (!baseURL || !apiKey) {
    throw new AiMisconfigured("Defina LLM_BASE_URL e LLM_API_KEY no .env.");
  }
  const modelId = process.env.LLM_MODEL || (await listModels()).defaultModelId;
  const provider = createOpenAICompatible({
    name: "llm",
    baseURL: baseURL.replace(/\/+$/, ""),
    apiKey,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
  return { model: provider(modelId), modelId };
}
