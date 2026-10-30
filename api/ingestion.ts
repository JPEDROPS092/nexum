import { extractText, getDocumentProxy } from "unpdf";
import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { TRPCError } from "@trpc/server";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CHARS = 120_000;

export function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CHARS);
}

export async function extractPdf(data: Uint8Array) {
  const parser = await getDocumentProxy(data);
  try {
    const result = await extractText(parser, { mergePages: true });
    const text = cleanText(Array.isArray(result.text) ? result.text.join("\n\n") : result.text);
    if (text.length < 30) throw new Error("PDF sem texto extraível. Se for digitalizado, aplique OCR antes de enviar.");
    return text;
  } finally { await parser.destroy(); }
}

function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80") || normalized === "::";
}

async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use apenas links http ou https.");
  if (url.username || url.password) throw new Error("URLs com credenciais não são permitidas.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateIp(entry.address))) throw new Error("O endereço precisa ser publicamente acessível.");
  return url;
}

async function readLimited(response: Response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("O documento excede o limite de 12 MB.");
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error("O documento excede o limite de 12 MB.");
  return buffer;
}

export async function extractUrl(raw: string) {
  let url = await assertPublicUrl(raw);
  let response: Response | undefined;
  for (let redirects = 0; redirects < 4; redirects++) {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "NexumLearning/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento inválido.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response?.ok) throw new Error(`Não foi possível acessar a fonte (HTTP ${response?.status ?? "desconhecido"}).`);
  const bytes = await readLimited(response);
  const contentType = response.headers.get("content-type") || "";
  const isPdf = contentType.includes("pdf") || url.pathname.toLowerCase().endsWith(".pdf");
  if (isPdf) return { text: await extractPdf(bytes), kind: "pdf" as const, finalUrl: url.toString() };
  const html = new TextDecoder().decode(bytes);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, iframe, form").remove();
  const title = cleanText($("title").first().text()).slice(0, 180);
  const main = $("main, article").first();
  const text = cleanText((main.length ? main : $("body")).text().replace(/\s*\n\s*/g, "\n"));
  if (text.length < 80) throw new Error("A página não forneceu texto suficiente para criar uma trilha.");
  return { text, kind: "web" as const, finalUrl: url.toString(), title };
}

export function ingestionError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Falha ao processar a fonte.";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
