# Plano da Fase 2: rede de segurança

Status: **em andamento**. Testes de caracterização prontos (`yarn test`). Harness de avaliação pronto em `perf-audit/eval/` (ver o README de lá); falta gravar as fontes e a referência.

Decisões tomadas: rodar a avaliação localmente no LM Studio (no lugar do Ollama) e usar como juiz um modelo maior no LM Studio. O ESLint 9 não foi aprovado e não será migrado.

Skills do plugin ECC que vou usar: `ai-regression-testing`, `eval-harness` e `tdd-workflow` (todas disponíveis nesta sessão).

## 1. Testes de caracterização (lógica sem LLM)

Framework: **Vitest** como dependência de desenvolvimento (não mexe em Next, ORM nem bibliotecas de LLM). Script novo `yarn test`. Os testes ficam em `src/**/__tests__/` e as fixtures em `perf-audit/fixtures/`.

| Alvo                            | Arquivo                                                           | O que o teste fixa                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Prompts                         | `src/lib/prompts/**`                                              | Snapshot do texto de cada prompt (com data congelada), para qualquer mudança aparecer no diff.                                |
| Montagem do contexto do redator | `src/lib/agents/search/index.ts:116-134`                          | Formato exato de `<search_results>` e `<widgets_result>` (extraído para uma função pura, sem mudar o resultado).              |
| Resposta do SearxNG             | `src/lib/searxng.ts`                                              | Parsing de respostas gravadas, parâmetros da URL, cabeçalhos e timeout.                                                       |
| Busca speed/balanced            | `baseSearch.ts:37-170`                                            | Com embeddings falsos e determinísticos: filtro de 0,5, deduplicação de 0,75, ordenação, top 20 e o que vai para a interface. |
| Busca quality                   | `baseSearch.ts:172-420`                                           | Com LLM falso: índices do seletor, URLs já lidos, junção dos fatos extraídos.                                                 |
| Extração de texto               | `src/lib/scraper.ts`                                              | HTML gravado servido por um servidor local; título e texto do Readability.                                                    |
| Chunking                        | `src/lib/utils/splitText.ts`                                      | Tamanhos, sobreposição, segmento maior que o limite, texto vazio.                                                             |
| Reranking dos uploads           | `src/lib/uploads/store.ts`                                        | Ordem do RRF com vetores fixos. O teste documenta o comportamento atual, inclusive o problema do hash com a nota.             |
| Deduplicação de fontes          | `researcher/index.ts:185-208`                                     | Junção de resultados com o mesmo URL.                                                                                         |
| Citações                        | `src/components/MessageRenderer/Citation.tsx` e o parser de `[n]` | Números viram links para a fonte certa.                                                                                       |
| Stream e sessão                 | `src/lib/session.ts`, `src/app/api/chat/route.ts`                 | Sequência de eventos `block`, `updateBlock`, `researchComplete`, `messageEnd` e o replay da reconexão.                        |
| API de busca                    | `src/app/api/search/route.ts`                                     | Formato de `message` e `sources`, com e sem `stream`, com o agente falso.                                                     |

## 2. Conjunto de avaliação de qualidade (30 perguntas)

Cada pergunta roda nos três modos. As respostas atuais viram a referência. As fontes (SearxNG e páginas) são gravadas uma vez e repetidas em todas as rodadas, para que só a mudança testada mude o resultado.

### A. Fatos simples (7)

1. Qual é a capital da Austrália?
2. Em que ano foi lançado o primeiro iPhone e por qual preço?
3. Qual é a altura oficial do Monte Everest segundo a medição de 2020?
4. Who wrote "One Hundred Years of Solitude" and when was it published?
5. Qual é a população do Brasil segundo o Censo 2022 do IBGE?
6. Quantos graus Fahrenheit tem o ponto de ebulição da água ao nível do mar? (espera-se `skipSearch`)
7. Quem ganhou a Copa do Mundo de 2022 e qual foi o placar da final?

### B. Perguntas que exigem várias fontes (8)

8. Compare Rust e Go para serviços web: desempenho, ecossistema e curva de aprendizado.
9. Quais são as diferenças entre PGBL e VGBL e para quem cada um é indicado?
10. What were the main causes and consequences of the 2008 financial crisis?
11. Quais são os prós e contras de carros elétricos e híbridos no Brasil hoje?
12. Como funciona o Pix e que impacto ele teve sobre os bancos brasileiros?
13. Explain the trade-offs between PostgreSQL and SQLite for a small web app.
14. Quais são os principais pontos da Reforma Tributária aprovada em 2023?
15. What has the Artemis program achieved so far and what are the next missions?

### C. Acadêmicas, com a fonte "acadêmico" ligada (5)

16. O que dizem os estudos recentes sobre jejum intermitente e perda de peso?
17. What does the research say about spaced repetition and long-term retention?
18. Quais foram os avanços recentes em baterias de estado sólido?
19. Summarize the main contributions of "Attention Is All You Need" and its impact.
20. Que evidências científicas existem sobre o efeito da cafeína na memória?

### D. Busca restrita por domínio (4)

Não existe um recurso dedicado no código: a restrição só funciona com `site:` na pergunta. Estas perguntas fixam esse comportamento. 21. site:gov.br como emitir a segunda via do CPF? 22. site:wikipedia.org história do Santos Dumont e do 14-bis 23. site:docs.python.org what is the difference between asyncio.gather and TaskGroup? 24. site:ibge.gov.br qual é a taxa de desemprego mais recente?

### E. Perguntas sobre arquivo enviado (4)

Arquivos de domínio público ou criados por mim, guardados em `perf-audit/fixtures/uploads/`. Nenhum arquivo de usuário real. 25. (PDF: trecho do art. 5º da Constituição Federal) O que o documento garante sobre liberdade de expressão? 26. (PDF: artigo do arXiv com licença CC-BY) Quem são os autores e qual é a principal contribuição? 27. (TXT: um capítulo de _Dom Casmurro_) Resuma o capítulo e liste os personagens que aparecem. 28. (DOCX: relatório fictício que vou criar) Quais são os três números mais importantes do relatório?

### F. Conversa com contexto e widget (2)

29. Histórico "Quem é o atual presidente da França?", seguido de "E quantos anos ele tem?" (testa a reescrita da pergunta).
30. Quanto é 15% de 2.340? (testa o widget de cálculo e o `skipSearch`).

Clima e cotação dependem de APIs ao vivo. Eles ficam nos testes de caracterização, com respostas gravadas, e fora da avaliação de qualidade.

## 3. Critérios de comparação

Duas camadas.

**Verificações automáticas, sem LLM (precisam passar em 100%):**

- todo `[n]` aponta para uma fonte que existe (1 a N);
- nenhuma citação quando a busca foi pulada;
- resposta no mesmo idioma da pergunta;
- Markdown válido e sem título principal (regra do prompt do redator);
- no quality, tamanho dentro de ±30% da referência.

**Juiz LLM com rubrica fixa** (temperatura 0, prompt versionado em `perf-audit/eval/judge-prompt.md`), notas de 1 a 5:

| Critério              | Pergunta ao juiz                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Relevância das fontes | As fontes citadas tratam da pergunta?                                                                                                            |
| Fundamentação         | Para até 10 afirmações com citação, o trecho da fonte `[n]` sustenta a afirmação? Nota = fração sustentada.                                      |
| Completude            | A resposta cobre os pontos-chave da referência? (Lista de pontos-chave por pergunta, gerada uma vez a partir da referência e revisada por você.) |
| Formato das citações  | As citações estão no lugar certo, sem citar widgets nem inventar fontes?                                                                         |

Também faço uma comparação lado a lado (nova contra referência, com as posições trocadas numa segunda rodada para evitar viés de ordem).

**Regra de aprovação de uma mudança:**

- nenhum critério cai mais de 0,3 ponto na média de qualquer modo;
- nenhuma pergunta cai 2 pontos ou mais em qualquer critério;
- as verificações automáticas passam em 100%.

Quando o juiz reprovar uma pergunta, ela vai para `perf-audit/eval/review-queue.md` com as duas respostas lado a lado, para sua revisão manual.

Antes de comparar qualquer mudança, rodo a referência 3 vezes para medir o ruído. Mesmo com temperatura 0, o agente pode variar.

## 4. Como a avaliação roda

- Um script (`perf-audit/eval/run.ts`) chama o `SearchAgent` direto, sem a interface, com um invólucro do LLM que força temperatura 0 e semente fixa. Assim não preciso mudar o código de produção para a avaliação.
- Um SearxNG falso responde com o JSON gravado para cada consulta. As páginas gravadas são servidas por um servidor local, e os URLs dos resultados apontam para ele, para que o Playwright continue no caminho real.
- Quando o pesquisador gera uma consulta que não foi gravada, o script registra a falta e devolve uma lista vazia. A taxa de consultas não gravadas entra no relatório, porque mudanças de prompt alteram as consultas.

## 5. O que preciso decidir com você

1. **Onde rodar o Ollama e gravar as fontes.** Este container não tem GPU (4 CPUs, 15 GB) e a rede dele bloqueia o ollama.com e os motores de busca, então não consigo gravar respostas reais do SearxNG daqui. Minha recomendação: gravar as fixtures e rodar o Ollama no seu computador, por uma sessão do Remote Control. A alternativa é você liberar esses domínios no ambiente e eu rodar um modelo pequeno na CPU, o que deixa o quality muito lento.
2. **Modelo fixo da avaliação.** Recomendo `qwen3:8b` no Ollama (aceita ferramentas; o Vane já desliga o modo de raciocínio dele). Precisa caber no seu hardware.
3. **Modelo juiz.** Um juiz mais forte que o modelo avaliado dá notas mais confiáveis. Opções: um modelo pago com a sua chave (por exemplo Claude ou GPT, por uma estimativa grosseira de US$ 2 a 6 por rodada completa das 90 respostas) ou um modelo local maior, como `qwen3:32b`, se o seu hardware aguentar.
4. **Lint.** Para ter lint de novo preciso migrar para o ESLint 9 com configuração flat. São só dependências de desenvolvimento. Posso fazer isso na Fase 2?
