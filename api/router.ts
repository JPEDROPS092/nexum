import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { progress, sources, trails } from "../db/schema";
import { extractPdf, extractUrl, ingestionError } from "./ingestion";
import { runLearningPipeline } from "./ai/pipeline";
import { languageSchema, levelSchema, lessonSchema, type Lesson } from "@contracts/lesson";
import { listModels } from "./ai-client";

const workspace = z.string().min(8).max(64);
const sourceRouter = createRouter({
  uploadPdf: publicQuery.input(z.object({ workspaceId: workspace, name: z.string().min(1).max(180), contentBase64: z.string().max(17_000_000) })).mutation(async ({ input }) => {
    try {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (bytes.length > 30 * 1024 * 1024) throw new Error("O PDF excede o limite de 30 MB.");
      const content = await extractPdf(bytes);
      const item = { id: randomUUID(), workspaceId: input.workspaceId, kind: "pdf", name: input.name.replace(/[\u0000-\u001f]/g, ""), content, charCount: content.length };
      await getDb().insert(sources).values(item);
      return { id: item.id, name: item.name, kind: item.kind, charCount: item.charCount };
    } catch (error) { ingestionError(error); }
  }),
  addUrl: publicQuery.input(z.object({ workspaceId: workspace, url: z.string().url().max(2000) })).mutation(async ({ input }) => {
    try {
      const extracted = await extractUrl(input.url);
      const name = extracted.title || new URL(extracted.finalUrl).hostname;
      const item = { id: randomUUID(), workspaceId: input.workspaceId, kind: extracted.kind, name: name.slice(0, 180), url: extracted.finalUrl, content: extracted.text, charCount: extracted.text.length };
      await getDb().insert(sources).values(item);
      return { id: item.id, name: item.name, kind: item.kind, url: item.url, charCount: item.charCount };
    } catch (error) { ingestionError(error); }
  }),
  list: publicQuery.input(z.object({ workspaceId: workspace })).query(async ({ input }) => {
    return getDb().select({ id: sources.id, name: sources.name, kind: sources.kind, url: sources.url, charCount: sources.charCount, createdAt: sources.createdAt }).from(sources).where(eq(sources.workspaceId, input.workspaceId)).orderBy(desc(sources.createdAt)).limit(50);
  }),
});

const trailRouter = createRouter({
  list: publicQuery.input(z.object({ workspaceId: workspace })).query(async ({ input }) => {
    const rows = await getDb().select().from(trails).where(eq(trails.workspaceId, input.workspaceId)).orderBy(desc(trails.updatedAt)).limit(50);
    return rows.map((row) => {
      const lesson = JSON.parse(row.lessonJson) as Lesson;
      return { id: row.id, title: row.title, topic: row.topic, description: lesson.description, language: row.language, level: row.level, category: lesson.category, stepCount: lesson.steps.length, createdAt: row.createdAt };
    });
  }),
  get: publicQuery.input(z.object({ workspaceId: workspace, id: z.string().uuid() })).query(async ({ input }) => {
    const row = await getDb().query.trails.findFirst({ where: and(eq(trails.id, input.id), eq(trails.workspaceId, input.workspaceId)) });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Trilha não encontrada." });
    return lessonSchema.parse(JSON.parse(row.lessonJson));
  }),
  generate: publicQuery.input(z.object({ workspaceId: workspace, topic: z.string().min(3).max(180), language: languageSchema, level: levelSchema, sourceIds: z.array(z.string().uuid()).max(6) })).mutation(async ({ input }) => {
    let selected: { name: string; content: string }[] = [];
    if (input.sourceIds.length) {
      const rows = await getDb().select({ id: sources.id, name: sources.name, content: sources.content }).from(sources).where(eq(sources.workspaceId, input.workspaceId));
      selected = rows.filter((row) => input.sourceIds.includes(row.id)).map(({ name, content }) => ({ name, content }));
      if (selected.length !== input.sourceIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais fontes não foram encontradas." });
    }
    const result = await runLearningPipeline({ topic: input.topic, language: input.language, level: input.level, sources: selected });
    const id = randomUUID();
    const lesson: Lesson = { ...result.lesson, id, language: input.language, level: input.level, duration: `${Math.max(6, result.lesson.steps.length * 3)} min`, sourceNames: selected.map(s => s.name), createdAt: new Date().toISOString() };
    await getDb().insert(trails).values({ id, workspaceId: input.workspaceId, title: lesson.title, topic: lesson.topic, language: lesson.language, level: lesson.level, lessonJson: JSON.stringify(lesson) });
    return { lesson, review: result.review, model: result.model };
  }),
  saveProgress: publicQuery.input(z.object({ workspaceId: workspace, trailId: z.string(), stepIndex: z.number().int().min(0).max(20) })).mutation(async ({ input }) => {
    const id = `${input.workspaceId}:${input.trailId}`.slice(0, 80);
    await getDb().insert(progress).values({ id, workspaceId: input.workspaceId, trailId: input.trailId, stepIndex: input.stepIndex }).onDuplicateKeyUpdate({ set: { stepIndex: input.stepIndex } });
    return { ok: true };
  }),
});

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  models: publicQuery.query(async () => listModels()),
  sources: sourceRouter,
  trails: trailRouter,
});
export type AppRouter = typeof appRouter;
