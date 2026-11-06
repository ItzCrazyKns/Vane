# Avaliação de qualidade (Fase 2)

Harness que roda as 30 perguntas de `questions.json` nos três modos, guarda as respostas e compara uma mudança com a referência. Nada em `src/` é alterado para rodar a avaliação.

## O que fica fixo

- **Modelo avaliado:** LM Studio, chamado pelas mesmas classes que o Vane usa (`LMStudioLLM`, `LMStudioEmbedding`). Todas as chamadas vão com temperatura 0 (`lib/models.ts`). O modelo usado fica gravado em `runs/<rótulo>/summary.json`.
- **SearxNG:** um servidor local (`lib/replay.ts`) responde no lugar da SearxNG. Com `--record`, ele repassa à SearxNG real e grava em `perf-audit/fixtures/eval/searxng/`. Sem `--record`, só responde o que foi gravado. Uma consulta não gravada devolve lista vazia e entra na taxa de faltas do `summary.json`.
- **Páginas (modo quality):** `Scraper.scrape` é envolvido em tempo de execução. Com `--record`, roda o Playwright de verdade e grava título e texto em `perf-audit/fixtures/eval/pages/`. Na repetição, devolve o texto gravado; URL não gravado recebe o mesmo formato de falha do scraper.
  - Mudança em relação ao plano: o plano previa servir o HTML gravado por um servidor local. Isso exigiria trocar os URLs das fontes, o que muda o que o modelo lê. Gravar a saída do scraper mantém os URLs reais. O custo do Playwright será medido à parte na Fase 3.
- **Arquivos enviados:** ficam em `perf-audit/fixtures/eval/uploads/` e passam pelo `UploadManager` real, numa pasta temporária. A pasta de dados do usuário nunca é lida nem escrita (`DATA_DIR` aponta para uma pasta temporária apagada no fim).

## Arquivos de teste enviados

| Arquivo | Origem |
| --- | --- |
| `constituicao-art5.pdf` | Trecho do art. 5º da Constituição (incisos I a X e XIV). Texto legal não tem direito autoral (Lei 9.610/98, art. 8º, IV). Digitado a partir do texto oficial; conferir com o site do Planalto na gravação. |
| `artigo-arxiv.pdf` | Título, autores e resumo de "Attention Is All You Need" (arXiv:1706.03762). Os metadados do arXiv são CC0. |
| `relatorio-ficticio.docx` | Relatório inventado. Os três números principais: receita de R$ 4,2 milhões (alta de 12%), 1.350 cooperados e inadimplência de 3,1%. |
| `dom-casmurro-cap.txt` | **Ainda falta.** Capítulo I de _Dom Casmurro_ (domínio público), baixado do Projeto Gutenberg na gravação, porque este container não acessa o site. |

## Como rodar

Na máquina com o LM Studio (servidor ligado em `http://localhost:1234`):

```bash
export EVAL_CHAT_MODEL=<modelo avaliado>        # ex.: qwen/qwen3-8b
export EVAL_EMBEDDING_MODEL=<modelo de embedding> # ex.: text-embedding-nomic-embed-text-v1.5
export EVAL_JUDGE_MODEL=<modelo juiz, maior>

# 1. Gravar fontes e a primeira referência
EVAL_SEARXNG_UPSTREAM=http://localhost:4000 npx tsx perf-audit/eval/run.ts --label referencia-1 --record

# 2. Mais duas rodadas só com o que foi gravado, para medir o ruído
npx tsx perf-audit/eval/run.ts --label referencia-2
npx tsx perf-audit/eval/run.ts --label referencia-3

# 3. Pontos-chave por pergunta (revisar à mão e mudar "reviewed" para true)
npx tsx perf-audit/eval/judge.ts --keypoints --from referencia-1

# 4. Notas da referência e ruído entre rodadas
npx tsx perf-audit/eval/judge.ts --run referencia-1
npx tsx perf-audit/eval/judge.ts --run referencia-2 --ref referencia-1
npx tsx perf-audit/eval/compare.ts --run referencia-2 --ref referencia-1
```

Para avaliar uma mudança: aplicar a mudança, rodar `run.ts --label <nome>`, depois `checks.ts --run <nome> --ref referencia-1`, `judge.ts --run <nome> --ref referencia-1` e `compare.ts --run <nome> --ref referencia-1`.

### Outros provedores de modelo

Qualquer endpoint compatível com a API da OpenAI funciona. As chaves vêm só do ambiente e nunca vão para os arquivos de saída.

| Variável | Uso | Padrão |
| --- | --- | --- |
| `EVAL_BASE_URL`, `EVAL_API_KEY` | modelo avaliado | LM Studio local, `lm-studio` |
| `EVAL_EMBEDDING_PROVIDER` | `openai` (mesmo endpoint) ou `transformers` (local, na CPU) | `openai` |
| `EVAL_EMBEDDING_BASE_URL`, `EVAL_EMBEDDING_API_KEY` | embeddings por API | os do modelo avaliado |
| `EVAL_JUDGE_BASE_URL`, `EVAL_JUDGE_API_KEY` | juiz | os do modelo avaliado |

A busca na web passa sempre pela SearxNG gravada, mesmo com `FIRECRAWL_API_URL` definido. Essa variável só troca o leitor de páginas, que fica registrado em `summary.json` (`scraper`).

Opções úteis de `run.ts`: `--modes speed,balanced` e `--ids A01,B08` para rodar só uma parte.

## Regra de aprovação (`compare.ts`)

- nenhum critério cai mais de 0,3 na média de qualquer modo;
- nenhuma pergunta cai 2 pontos ou mais em qualquer critério;
- nenhuma regressão nas verificações automáticas (`checks.ts`).

As verificações automáticas comparam com a referência: uma verificação que a própria referência já reprova (por exemplo, idioma trocado pelo modelo) não conta como regressão, mas aparece no relatório.

Perguntas reprovadas, ou em que o juiz preferiu a referência nas duas ordens, vão para `review-queue.md` com as duas respostas lado a lado.

## Arquivos

- `run.ts`: roda as perguntas e grava `runs/<rótulo>/<id>.<modo>.json`.
- `checks.ts`, `lib/checks.ts`: verificações sem LLM.
- `judge.ts`, `lib/judge-client.ts`, `judge-prompt.md`: juiz com rubrica fixa e comparação lado a lado.
- `compare.ts`: regra de aprovação e fila de revisão.
- `__tests__/harness.test.ts`: testes do replay e das verificações (rodam no `yarn test`).
