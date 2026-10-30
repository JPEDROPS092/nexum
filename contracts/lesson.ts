import { z } from "zod";

export const languageSchema = z.enum(["pt", "en"]);
export const levelSchema = z.enum(["iniciante", "intermediario", "avancado"]);

export const parameterSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string(),
  min: z.number(), max: z.number(), step: z.number().positive(), value: z.number(),
  unit: z.string().optional(),
});

const base = { id: z.string(), color: z.string().optional(), opacity: z.number().min(0).max(1).optional() };
export const elementSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("axes"), xLabel: z.string().optional(), yLabel: z.string().optional(), grid: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("function"), expression: z.string(), variable: z.string().optional(), samples: z.number().int().min(20).max(500).optional(), dash: z.array(z.number()).optional() }),
  z.object({ ...base, type: z.literal("point"), x: z.number(), y: z.number(), xExpression: z.string().optional(), yExpression: z.string().optional(), label: z.string().optional(), radius: z.number().optional() }),
  z.object({ ...base, type: z.literal("line"), from: z.array(z.number()).length(2), to: z.array(z.number()).length(2), dash: z.array(z.number()).optional(), label: z.string().optional() }),
  z.object({ ...base, type: z.literal("vector"), x: z.number(), y: z.number(), dx: z.number(), dy: z.number(), label: z.string().optional() }),
  z.object({ ...base, type: z.literal("circle"), x: z.number(), y: z.number(), radius: z.number(), fill: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("bar"), x: z.number(), height: z.number(), width: z.number().optional(), label: z.string().optional(), state: z.enum(["default", "active", "done", "muted"]).optional() }),
  z.object({ ...base, type: z.literal("text"), x: z.number(), y: z.number(), text: z.string(), size: z.number().optional(), align: z.enum(["left", "center", "right"]).optional() }),
  z.object({ ...base, type: z.literal("path"), points: z.array(z.array(z.number()).length(2)).min(2), closed: z.boolean().optional(), fill: z.boolean().optional() }),
]);

export const sceneSchema = z.object({
  viewport: z.object({ xMin: z.number(), xMax: z.number(), yMin: z.number(), yMax: z.number() }),
  elements: z.array(elementSchema).max(30),
  caption: z.string().optional(),
});

export const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  formula: z.string().optional(),
  insight: z.string().optional(),
  duration: z.number().min(3).max(15).default(6),
  scene: sceneSchema,
  code: z.string().optional(),
  activeLine: z.number().int().min(0).optional(),
  citation: z.string().optional(),
});

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  description: z.string(),
  language: languageSchema,
  level: levelSchema,
  category: z.enum(["matematica", "codigo"]),
  duration: z.string(),
  parameters: z.array(parameterSchema).max(4),
  steps: z.array(stepSchema).min(3).max(8),
  sourceNames: z.array(z.string()),
  createdAt: z.string(),
});

export const generatedLessonSchema = lessonSchema.omit({ id: true, createdAt: true, sourceNames: true, duration: true });
export type Lesson = z.infer<typeof lessonSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneElement = z.infer<typeof elementSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type Language = z.infer<typeof languageSchema>;

export interface SourceItem { id: string; name: string; kind: "pdf" | "web"; url?: string; charCount: number; createdAt: Date | string }
export interface TrailSummary { id: string; title: string; topic: string; description: string; language: Language; level: string; category: string; stepCount: number; createdAt: Date | string; sample?: boolean }
