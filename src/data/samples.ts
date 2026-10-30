import type { Lesson, Scene, SceneElement, Step } from "@contracts/lesson";

const now = new Date().toISOString();
const axes: SceneElement = { id: "axes", type: "axes", xLabel: "x", yLabel: "f(x)", grid: true };
const viewport = { xMin: -1.2, xMax: 4.2, yMin: -1.2, yMax: 9.2 };
const curve = (expression = "a*x^2"): SceneElement => ({ id: "curve", type: "function", expression, color: "#20221f" });
const scene = (elements: SceneElement[], caption: string): Scene => ({ viewport, elements: [axes, ...elements], caption });

const derivativeSteps: Step[] = [
  {
    id: "d1", title: "Comece com uma curva", duration: 6,
    body: "A função f(x) = ax² associa cada valor de x a uma altura. Antes de falar em derivada, observe a curva: sua inclinação muda a todo instante.",
    formula: "f(x) = ax²", insight: "A derivada mede uma mudança local, não a altura da função.",
    scene: scene([curve(), { id: "p", type: "point", x: 2, y: 4, yExpression: "a*4", label: "P = (2, 4)", color: "#ff5c35", radius: 6 }], "Uma curva, infinitas inclinações."),
  },
  {
    id: "d2", title: "Aproxime com uma reta secante", duration: 7,
    body: "Escolha um segundo ponto Q, a uma distância h de P. A reta que passa pelos dois pontos é uma secante. Sua inclinação é a taxa média de variação entre eles.",
    formula: "m = [f(2+h) − f(2)] / h", insight: "Dois pontos transformam mudança em uma razão.",
    scene: scene([curve(), { id: "secant", type: "line", from: [0.5, -1], to: [3.5, 9], color: "#ff5c35" }, { id: "p", type: "point", x: 2, y: 4, yExpression: "a*4", label: "P", color: "#ff5c35" }, { id: "q", type: "point", x: 3, y: 9, yExpression: "a*9", label: "Q", color: "#72766c" }, { id: "h", type: "text", x: 2.5, y: 0.2, text: "h = 1", color: "#ff5c35" }], "A secante corta a curva em P e Q."),
  },
  {
    id: "d3", title: "Faça h tender a zero", duration: 7,
    body: "Quando Q se aproxima de P, h fica cada vez menor. A secante gira suavemente até encostar na curva em apenas um ponto: nasce a reta tangente.",
    formula: "f′(2) = lim(h→0) [f(2+h) − f(2)] / h", insight: "O limite preserva a direção no instante em que a distância desaparece.",
    scene: scene([curve(), { id: "tangent", type: "line", from: [0.5, -2], to: [3.2, 8.8], color: "#ff5c35" }, { id: "p", type: "point", x: 2, y: 4, yExpression: "a*4", label: "P = Q", color: "#ff5c35", radius: 7 }, { id: "h", type: "text", x: 2.45, y: 0.2, text: "h → 0", color: "#ff5c35" }], "No limite, a secante vira tangente."),
  },
  {
    id: "d4", title: "Calcule o limite", duration: 8,
    body: "Para f(x) = ax², expanda a(2+h)², simplifique e divida por h. O termo h que resta desaparece no limite, deixando 4a — exatamente a inclinação da tangente em P.",
    formula: "f′(2) = lim(h→0) a(4h+h²)/h = 4a", insight: "A álgebra remove a indeterminação 0/0 antes do limite.",
    scene: scene([curve(), { id: "tangent", type: "line", from: [0.5, -2], to: [3.2, 8.8], color: "#ff5c35" }, { id: "p", type: "point", x: 2, y: 4, yExpression: "a*4", color: "#ff5c35", radius: 7 }, { id: "slope", type: "text", x: 2.25, y: 6.4, text: "m = 4a", size: 22, color: "#ff5c35" }], "A tangente sobe 4 unidades para cada unidade horizontal."),
  },
  {
    id: "d5", title: "Generalize para qualquer ponto", duration: 7,
    body: "O mesmo raciocínio funciona em qualquer x. O resultado é uma nova função, f′(x) = 2ax, que informa a inclinação original em cada posição.",
    formula: "d/dx [ax²] = 2ax", insight: "Derivar é transformar uma função em seu mapa de inclinações.",
    scene: scene([curve(), { id: "slopefield", type: "vector", x: 2, y: 4, dx: 0.65, dy: 2.6, color: "#ff5c35", label: "f′(2) = 4a" }, { id: "p", type: "point", x: 2, y: 4, yExpression: "a*4", color: "#ff5c35" }], "Experimente mudar a e observe a família de parábolas."),
  },
];

export const derivativeLesson: Lesson = {
  id: "sample-derivative", title: "A derivada, em movimento", topic: "Derivadas e taxa de variação",
  description: "Da reta secante ao limite: veja a derivada nascer geometricamente e aprenda a calculá-la.",
  language: "pt", level: "iniciante", category: "matematica", duration: "12 min",
  parameters: [{ id: "a", label: "Coeficiente a", min: 0.35, max: 1.4, step: 0.05, value: 1 }],
  steps: derivativeSteps, sourceNames: ["Exemplo editorial Nexum"], createdAt: now,
};

const values = [3, 8, 12, 19, 27, 34, 42, 56, 68];
const bars = (active = -1, done: number[] = [], muted: number[] = []): SceneElement[] => values.map((v, i) => ({
  id: `bar${i}`, type: "bar", x: i, height: v / 10, width: 0.65, label: String(v),
  state: active === i ? "active" : done.includes(i) ? "done" : muted.includes(i) ? "muted" : "default",
  color: active === i ? "#ff5c35" : undefined,
}));
const codeScene = (active: number, caption: string, done: number[] = [], muted: number[] = []): Scene => ({
  viewport: { xMin: -0.8, xMax: 8.8, yMin: -0.6, yMax: 7.5 },
  elements: [...bars(active, done, muted), { id: "label", type: "text", x: 4, y: -0.35, text: "índices  0    1    2    3    4    5    6    7    8", align: "center", color: "#72766c" }], caption,
});
const python = `def busca_binaria(lista, alvo):\n    inicio, fim = 0, len(lista) - 1\n    while inicio <= fim:\n        meio = (inicio + fim) // 2\n        if lista[meio] == alvo:\n            return meio\n        if lista[meio] < alvo:\n            inicio = meio + 1\n        else:\n            fim = meio - 1\n    return -1`;

export const binaryLesson: Lesson = {
  id: "sample-binary", title: "Busca binária, sem adivinhação", topic: "Algoritmos de busca",
  description: "Descarte metade do espaço de busca a cada passo e entenda por que a complexidade é O(log n).",
  language: "pt", level: "iniciante", category: "codigo", duration: "10 min", parameters: [],
  sourceNames: ["Exemplo editorial Nexum"], createdAt: now,
  steps: [
    { id: "b1", title: "Ordem é a premissa", body: "A busca binária só funciona em uma lista ordenada. Nosso alvo é 34. Em vez de inspecionar cada elemento, começamos pelo meio.", formula: "entrada ordenada + alvo = 34", insight: "Sem ordenação, comparar com o meio não permite descartar metades.", duration: 6, scene: codeScene(4, "Nove elementos ordenados; o alvo é 34."), code: python, activeLine: 1 },
    { id: "b2", title: "Compare com o elemento central", body: "O elemento central é 27. Como 27 é menor que 34, o alvo só pode estar à direita. Toda a metade esquerda deixa de ser candidata.", formula: "27 < 34 → inicio = meio + 1", insight: "Uma comparação elimina cinco posições de uma vez.", duration: 7, scene: codeScene(4, "A metade esquerda foi descartada.", [], [0,1,2,3,4]), code: python, activeLine: 7 },
    { id: "b3", title: "Repita no intervalo restante", body: "O novo intervalo começa no índice 5. Seu elemento central é 42, maior que o alvo. Agora descartamos a metade direita.", formula: "42 > 34 → fim = meio − 1", insight: "O intervalo encolhe, mas a regra permanece a mesma.", duration: 7, scene: codeScene(6, "O intervalo passa a conter apenas o índice 5.", [6], [0,1,2,3,4,7,8]), code: python, activeLine: 9 },
    { id: "b4", title: "Encontre o alvo", body: "O intervalo contém apenas o índice 5. O valor 34 é igual ao alvo, então o algoritmo retorna sua posição.", formula: "lista[5] = 34 → retornar 5", insight: "Três comparações bastaram em uma lista de nove itens.", duration: 6, scene: codeScene(5, "Alvo encontrado no índice 5.", [5], [0,1,2,3,4,6,7,8]), code: python, activeLine: 5 },
    { id: "b5", title: "Entenda o custo", body: "Cada comparação reduz o intervalo pela metade. Com n elementos, são necessárias no máximo log₂(n+1) comparações — um crescimento muito lento.", formula: "T(n) = O(log₂ n)", insight: "Dobrar a entrada adiciona apenas uma comparação.", duration: 7, scene: codeScene(5, "9 itens → 5 → 3 → 1: no máximo 4 comparações.", [5], []), code: python, activeLine: 3 },
  ],
};

export const sampleLessons = [derivativeLesson, binaryLesson];
const derivativeEn = [
  ["Start with a curve", "The function f(x) = ax² maps every x to a height. Before naming the derivative, watch the curve: its slope changes at every instant.", "The derivative measures local change, not the function's height.", "One curve, infinitely many slopes."],
  ["Approximate with a secant line", "Choose a second point Q, at a horizontal distance h from P. The line through both points is a secant. Its slope is the average rate of change between them.", "Two points turn change into a ratio.", "The secant crosses the curve at P and Q."],
  ["Let h approach zero", "As Q moves toward P, h gets smaller. The secant rotates smoothly until it touches the curve at one point: the tangent line is born.", "The limit preserves direction at the instant distance disappears.", "In the limit, the secant becomes a tangent."],
  ["Evaluate the limit", "For f(x) = ax², expand a(2+h)², simplify and divide by h. The remaining h vanishes in the limit, leaving 4a — exactly the tangent's slope at P.", "Algebra removes the 0/0 indeterminacy before the limit.", "The tangent rises 4a units per horizontal unit."],
  ["Generalize to any point", "The same reasoning works at any x. The result is a new function, f′(x) = 2ax, that reports the original slope at every position.", "Differentiating turns a function into its slope map.", "Change a and explore the family of parabolas."],
];
const binaryEn = [
  ["Order is the premise", "Binary search only works on a sorted list. Our target is 34. Instead of inspecting every element, we start in the middle.", "Without order, comparing with the middle cannot discard halves.", "Nine sorted elements; the target is 34."],
  ["Compare with the middle element", "The middle element is 27. Since 27 is less than 34, the target can only be on the right. The entire left half is no longer a candidate.", "One comparison eliminates five positions at once.", "The left half has been discarded."],
  ["Repeat on the remaining interval", "The new interval starts at index 5. Its middle element is 42, greater than the target. Now we discard the right half.", "The interval shrinks, but the rule stays the same.", "Only index 5 remains in the interval."],
  ["Find the target", "The interval contains only index 5. The value 34 equals the target, so the algorithm returns its position.", "Three comparisons were enough in a list of nine items.", "Target found at index 5."],
  ["Understand the cost", "Each comparison halves the interval. With n elements, at most log₂(n+1) comparisons are needed — remarkably slow growth.", "Doubling the input adds only one comparison.", "9 items → 5 → 3 → 1: at most 4 comparisons."],
];
const pythonEn = `def binary_search(items, target):\n    start, end = 0, len(items) - 1\n    while start <= end:\n        middle = (start + end) // 2\n        if items[middle] == target:\n            return middle\n        if items[middle] < target:\n            start = middle + 1\n        else:\n            end = middle - 1\n    return -1`;

export function localizedSample(lesson: Lesson, language: "pt" | "en"): Lesson {
  if (language === "pt") return lesson;
  const translations = lesson.id === "sample-derivative" ? derivativeEn : binaryEn;
  return {
    ...lesson,
    title: lesson.id === "sample-derivative" ? "The derivative, in motion" : "Binary search, no guessing",
    topic: lesson.id === "sample-derivative" ? "Derivatives and rate of change" : "Search algorithms",
    description: lesson.id === "sample-derivative" ? "From secant line to limit: watch the derivative emerge geometrically and learn to calculate it." : "Discard half the search space at each step and understand why the complexity is O(log n).",
    language: "en", sourceNames: ["Nexum editorial example"],
    parameters: lesson.parameters.map(p => ({ ...p, label: "Coefficient a" })),
    steps: lesson.steps.map((step, index) => ({ ...step, title: translations[index][0], body: translations[index][1], insight: translations[index][2], code: lesson.id === "sample-binary" ? pythonEn : step.code, scene: { ...step.scene, caption: translations[index][3] } })),
  };
}
