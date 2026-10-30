import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateObject } from "ai";
import { z } from "zod";
import {
  generatedLessonSchema,
  languageSchema,
  levelSchema,
} from "@contracts/lesson";
import { classifyAiError } from "../ai-client";
import { getModel } from "../lib/llm";

const researchSchema = z.object({
  summary: z.string(),
  keyConcepts: z.array(z.string()).min(3).max(8),
  prerequisites: z.array(z.string()).max(5),
  misconceptions: z.array(z.string()).max(5),
  evidence: z
    .array(z.object({ source: z.string(), excerpt: z.string() }))
    .max(8),
});
const outlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.enum(["matematica", "codigo"]),
  steps: z
    .array(
      z.object({
        title: z.string(),
        objective: z.string(),
        visualIdea: z.string(),
      }),
    )
    .min(4)
    .max(6),
});
const reviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()).max(8),
  qualityScore: z.number().min(0).max(10),
});

const GraphState = Annotation.Root({
  topic: Annotation<string>,
  language: Annotation<"pt" | "en">,
  level: Annotation<string>,
  sourceText: Annotation<string>,
  sourceNames: Annotation<string[]>,
  research: Annotation<z.infer<typeof researchSchema>>,
  outline: Annotation<z.infer<typeof outlineSchema>>,
  lesson: Annotation<z.infer<typeof generatedLessonSchema>>,
  review: Annotation<z.infer<typeof reviewSchema>>,
  repairs: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

export interface GenerateInput {
  topic: string;
  language: "pt" | "en";
  level: string;
  sources: { name: string; content: string }[];
}

export async function runLearningPipeline(input: GenerateInput) {
  const { model, modelId: defaultModelId } = await getModel();
  const locale = input.language === "pt" ? "português do Brasil" : "English";
  const sourceText = input.sources.length
    ? input.sources
        .map(
          (s, i) =>
            `\n=== FONTE ${i + 1}: ${s.name} ===\n${s.content.slice(0, 28_000)}`,
        )
        .join("\n")
        .slice(0, 65_000)
    : "Nenhuma fonte fornecida. Use conhecimento consolidado e sinalize que a trilha é uma síntese introdutória.";
  const common = `Responda todo o conteúdo pedagógico em ${locale}. Tema: ${input.topic}. Nível: ${input.level}.`;

  const researcher = async (state: typeof GraphState.State) => {
    const { object } = await generateObject({
      model,
      schema: researchSchema,
      prompt: `${common}\nVocê é o agente PESQUISADOR. Leia as fontes com atenção, extraia conceitos, pré-requisitos, erros comuns e evidências curtas fiéis às fontes. Não invente citações ou fontes não consultadas.\n${state.sourceText}`,
    });
    return { research: object };
  };
  const architect = async (state: typeof GraphState.State) => {
    const { object } = await generateObject({
      model,
      schema: outlineSchema,
      prompt: `${common}\nVocê é o agente ARQUITETO DE APRENDIZAGEM. Converta a pesquisa em uma sequência de 4 a 6 passos com progressão conceitual e uma ideia visual específica em cada passo. Foque em matemática e/ou código.\nPESQUISA:\n${JSON.stringify(state.research)}`,
    });
    return { outline: object };
  };
  const director = async (state: typeof GraphState.State) => {
    const { object } = await generateObject({
      model,
      schema: generatedLessonSchema,
      prompt: `${common}\nVocê é o agente DIRETOR DE CENAS. Gere a lição completa seguindo o outline e o schema. Responda explicitamente às dúvidas e aos objetivos do usuário ao longo da progressão. Cada passo precisa de texto claro, fórmula quando útil, insight e uma cena declarativa. Crie IDs consistentes entre cenas para permitir interpolação. Use viewports com xMin<xMax e yMin<yMax. Expressões de funções usam mathjs, variável x e parâmetros declarados (ex.: a*x^2). Para código, use barras, textos, linhas e o campo code com activeLine. Não use HTML, JavaScript solto, SVG ou coordenadas fora do viewport. As cenas devem visualizar exatamente o conceito narrado.\nPESQUISA:\n${JSON.stringify(state.research)}\nOUTLINE:\n${JSON.stringify(state.outline)}\nFONTES:\n${state.sourceText.slice(0, 24_000)}`,
    });
    return { lesson: object };
  };
  const reviewer = async (state: typeof GraphState.State) => {
    const { object } = await generateObject({
      model,
      schema: reviewSchema,
      prompt: `${common}\nVocê é o agente REVISOR. Verifique correção matemática/computacional, progressão, aderência às fontes, legibilidade e coerência entre texto e cena. Reprove se houver erro factual, expressão inválida ou cena sem relação com o passo. Liste problemas objetivos; aprove se estiver sólido.\nLIÇÃO:\n${JSON.stringify(state.lesson)}`,
    });
    return { review: object };
  };
  const repair = async (state: typeof GraphState.State) => {
    const { object } = await generateObject({
      model,
      schema: generatedLessonSchema,
      prompt: `${common}\nVocê é o agente DIRETOR DE CENAS em revisão. Corrija todos os problemas apontados sem perder os pontos fortes. Preserve o schema declarativo e IDs consistentes.\nPROBLEMAS:\n${JSON.stringify(state.review.issues)}\nLIÇÃO ATUAL:\n${JSON.stringify(state.lesson)}\nPESQUISA:\n${JSON.stringify(state.research)}`,
    });
    return { lesson: object, repairs: 1 };
  };

  const graph = new StateGraph(GraphState)
    .addNode("pesquisador", researcher)
    .addNode("arquiteto", architect)
    .addNode("diretor", director)
    .addNode("revisor", reviewer)
    .addNode("revisao", repair)
    .addEdge(START, "pesquisador")
    .addEdge("pesquisador", "arquiteto")
    .addEdge("arquiteto", "diretor")
    .addEdge("diretor", "revisor")
    .addConditionalEdges("revisor", (state) =>
      !state.review.approved && state.repairs < 1 ? "revisao" : END,
    )
    .addEdge("revisao", END)
    .compile();

  try {
    const result = await graph.invoke({
      topic: input.topic,
      language: input.language,
      level: input.level,
      sourceText,
      sourceNames: input.sources.map((s) => s.name),
      repairs: 0,
    });
    return {
      lesson: generatedLessonSchema.parse(result.lesson),
      review: result.review,
      model: defaultModelId,
    };
  } catch (error) {
    throw classifyAiError(error);
  }
}
