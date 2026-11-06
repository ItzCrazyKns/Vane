# Plano da Fase 3: rede de segurança

Status: **proposta para aprovação**. Substitui o `phase2-plan.md` da rodada anterior, que tinha outra numeração de fases. Boa parte da infraestrutura já existe no `master`; este plano diz o que falta.

## 1. Testes de caracterização (sem LLM)

Já existem 22 arquivos e 132 testes passando (`vitest run`). Cobrem: `baseSearch` (speed/balanced com embeddings falsos e quality com LLM falso), o pipeline com snapshots, SearxNG, Firecrawl, `webSearch`, sessão, MCP, Bifrost, contexto e orçamento, Discover, uploads (RRF), prompts e as rotas `search` e `discover`.

Falta cobrir (skill `ai-regression-testing` e `tdd-workflow`; fixtures gravadas em `perf-audit/fixtures/`):

| Alvo | Arquivo | O que fixar |
|---|---|---|
| Extração de texto | `src/lib/scraper.ts` | HTML gravado → título e texto do Readability; timeout de 20 s; página grande. |
| Chunking | `src/lib/utils/splitText.ts` | Tamanhos, sobreposição, segmento maior que o limite, texto vazio. |
| Citações | `src/lib/utils/citations.ts` e o renderizador | `[n]` vira link para a fonte certa; `[n]` fora do intervalo. |
| Rota do chat e reconexão | `src/app/api/chat/route.ts`, `src/app/api/reconnect/[id]/route.ts` | Sequência `block` → `updateBlock` → `researchComplete` → `messageEnd`; replay da reconexão; aborto do cliente. |
| Banco | `src/lib/db/*`, rotas `/api/chats` | Criar, listar, abrir e apagar conversa num SQLite temporário; migração com `DATA_DIR` fora da raiz (bug da Fase 2). |
| Configuração | `src/lib/config/index.ts`, `/api/config` | Leitura, gravação, chaves proibidas (`__proto__`), o que vai para o cliente. |
| Widgets | `weatherWidget`, `stockWidget`, `calculationWidget` | Com LLM falso e respostas gravadas das APIs externas. |

## 2. Testes de ponta a ponta na interface (agente `e2e-runner`, skill `e2e-testing`)

Playwright com o Chromium do container, contra o build de produção, um provedor falso compatível com OpenAI e uma SearxNG falsa (os dois já existem como scripts de teste). Fluxos:

1. Busca em cada modo (speed, balanced, quality) até a resposta com fontes.
2. Envio de um arquivo e pergunta sobre ele.
3. Abrir o histórico e reabrir uma conversa.
4. Mudar a configuração (provedor e modelo) e fazer uma busca nova.
5. Cancelar uma busca no meio e começar outra: a resposta antiga não pode aparecer na nova.
6. Recarregar a página durante o streaming (reconexão).

Cada teste verifica também que não há erros no console nem requisições falhando. Os testes ficam fora do `vitest run` padrão (`npm run test:e2e`), porque precisam do build.

## 3. Conjunto de avaliação de qualidade

O harness já existe em `perf-audit/eval/` (gravação e repetição da SearxNG e das páginas, verificações automáticas, juiz com rubrica fixa, comparação e fila de revisão manual). As 30 perguntas estão em `questions.json`:

| Grupo | Qtd. | Exemplos |
|---|---|---|
| Fatos simples | 7 | capital da Austrália; Censo 2022; ponto de ebulição em °F (deve pular a busca) |
| Várias fontes | 8 | Rust x Go; PGBL x VGBL; Reforma Tributária; Artemis |
| Acadêmicas (fonte acadêmica) | 5 | jejum intermitente; repetição espaçada; "Attention Is All You Need" |
| Busca por domínio (`site:`) | 4 | `site:gov.br` segunda via do CPF; `site:docs.python.org` asyncio |
| Sobre arquivo enviado | 4 | art. 5º da Constituição (PDF); artigo do arXiv (PDF); Dom Casmurro (TXT); relatório fictício (DOCX) |
| Conversa e widget | 2 | pergunta de seguimento; 15% de 2.340 |

Cada pergunta roda nos três modos: 90 respostas por rodada.

**Verificações automáticas (100% obrigatório):** toda citação `[n]` aponta para uma fonte existente; nenhuma citação quando a busca foi pulada; mesmo idioma da pergunta; sem título principal; no quality, tamanho dentro de ±30% da referência; `site:` respeitado nas fontes.

**Juiz com rubrica fixa** (temperatura 0, `judge-prompt.md`), notas de 1 a 5: relevância das fontes, afirmações sustentadas pelas fontes (até 10 por resposta), completude contra os pontos-chave da referência, formato das citações. Mais uma comparação lado a lado com as posições trocadas.

**Regra de aprovação de uma mudança:** nenhum critério cai mais de 0,3 na média de qualquer modo; nenhuma pergunta cai 2 pontos ou mais; verificações automáticas em 100%. Reprovações vão para `perf-audit/eval/review-queue.md`, para sua revisão. A referência roda 3 vezes antes de qualquer comparação, para medir o ruído.

## 4. O que muda em relação ao que já está no repositório

1. **Ollama.** O roteiro novo pede um modelo fixo no Ollama; o harness atual chama o LM Studio. Vou acrescentar `EVAL_PROVIDER=ollama`, que usa a classe `OllamaLLM` do próprio Vane (o mesmo caminho de produção do Ollama), mantendo o LM Studio como opção.
2. **Playwright saiu do Vane.** O README do harness ainda fala em Playwright; o wrapper já envolve `Scraper.scrape`, que agora usa `fetch` + Readability ou Firecrawl. Só a documentação muda.
3. **Uso de tokens.** O harness passa a registrar o campo `usage` de cada chamada (para provedores pagos e para o Ollama, que informa `prompt_eval_count` e `eval_count`), o que alimenta a Fase 4.
4. **Falta o arquivo `dom-casmurro-cap.txt`.** Será baixado do Projeto Gutenberg na máquina que gravar as referências.

## 5. Decisões que preciso de você

1. **Onde gravar as referências e rodar o modelo fixo.** Este container não tem GPU nem Ollama, e não alcança os motores de busca. A gravação precisa rodar no seu Mac (pelos comandos do README do harness ou por uma sessão do Remote Control, se ela funcionar).
2. **Modelo fixo:** antes você escolheu o LM Studio; o roteiro novo diz Ollama. Recomendo `qwen3:8b` no Ollama (aceita ferramentas e o Vane já desliga o raciocínio dele). Se preferir continuar no LM Studio, o harness já funciona.
3. **Juiz:** você escolheu um modelo maior local. Mantenho, a menos que prefira um pago.
4. **Lint:** continua quebrado; consertar exige migrar para o ESLint 9 (só desenvolvimento). Você não aprovou na rodada anterior; sigo sem lint, usando `tsc` e testes como portão.
