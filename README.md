# Nexum — trilhas interativas multiagente

Aplicação full-stack para transformar um tema, PDFs e páginas públicas em aulas visuais de matemática e programação. A interface e o conteúdo gerado podem usar português ou inglês.

## Executar

```bash
npm install
npm run db:push
npm run dev
```

O servidor de desenvolvimento abre em `http://localhost:3000`. As variáveis de ambiente do banco e do gateway de IA ficam somente no servidor; nunca devem ser expostas no código do navegador.

```bash
npm run check   # verificação TypeScript
npm run build   # frontend + servidor de produção
npm start       # executa dist/boot.js na porta 3000
```

## Fluxo de geração

O backend executa um grafo real com LangGraph:

1. **Pesquisador** — organiza evidências e conceitos das fontes selecionadas.
2. **Arquiteto** — define a progressão didática.
3. **Diretor de cena** — escreve a aula e gera cenas declarativas.
4. **Revisor** — verifica coerência factual, pedagógica e visual; uma rodada de correção pode ser acionada.

O modelo é descoberto em tempo de execução por `listModels()` e chamado pelo AI SDK com um provedor OpenAI-compatible. Não há ID de modelo, credencial ou endereço de gateway fixado no frontend.

## Contrato visual

`contracts/lesson.ts` concentra os esquemas Zod compartilhados. O modelo produz dados, nunca JavaScript executável. O renderizador Canvas interpreta eixos, funções, pontos, retas, vetores, círculos, barras, textos e caminhos, com transições entre passos e parâmetros editáveis. Expressões matemáticas são avaliadas pelo MathJS.

## Fontes e persistência

- PDFs enviados: até 12 MB e 120.000 caracteres extraídos; documentos digitalizados precisam de OCR prévio.
- Links HTTP/HTTPS públicos: páginas web ou PDFs, com limite de tempo e tamanho.
- O PDF original não é retido; somente o texto extraído e seus metadados são armazenados.
- Trilhas, fontes e progresso ficam no MySQL e são isolados por um identificador anônimo de workspace salvo neste navegador.
- URLs remotas passam por validação de protocolo, DNS, endereços privados e redirecionamentos para reduzir riscos de SSRF.

## Estrutura principal

- `api/ai/pipeline.ts` — orquestração LangGraph e saídas estruturadas.
- `api/ingestion.ts` — extração e validação de PDFs e páginas web.
- `api/router.ts` — procedimentos tRPC.
- `contracts/lesson.ts` — contratos compartilhados das aulas e cenas.
- `db/schema.ts` — fontes, trilhas e progresso.
- `src/components/SceneCanvas.tsx` — renderização e animação das cenas.
- `src/components/NewTrailDialog.tsx` — criação, fontes e estado da geração.
- `src/lib/i18n.ts` — textos da interface em PT/EN.
- `src/data/samples.ts` — exemplos editoriais bilíngues.

## Controles

Play/pausa, passo anterior/próximo, reinício, seleção direta na linha do tempo, velocidade de 0,75× a 2× e parâmetros interativos. No teclado: setas para navegar, espaço para reproduzir/pausar e `R` para reiniciar. O layout se adapta a desktop e celular.
