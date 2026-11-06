# Fork module195/Vane vs upstream ItzCrazyKns/Vane (antigo Perplexica)

Data da coleta: 06/11/2026. Pesquisa só de leitura. Nada foi escrito no GitHub.

## Ferramentas usadas e falhas

| Ferramenta | Resultado |
| --- | --- |
| `git fetch` do upstream (`master` e `canary`) em refs temporários (`refs/remotes/upstream/*`) | OK. O branch atual e a árvore de trabalho não mudaram. |
| `gh api search/issues` | OK. A primeira rodada deu erro 422 porque a busca exige `is:issue` ou `is:pull-request`. Corrigi e rodei de novo. |
| GitHub MCP (`mcp__github__*`) | **Só funciona no fork.** No upstream volta `Access denied: repository "itzcrazykns/vane" is not configured for this session`. Por isso usei a busca do `gh` (que traz título, estado e corpo) para tudo do upstream. |
| DeepWiki (`read_wiki_structure`, `ask_wiki_question`) | OK. Fiz 2 perguntas. |
| Servidores MCP context7 e exa | Não conectaram (ERR_PROXY_TUNNEL). Não eram necessários. |
| Nome antigo `ItzCrazyKns/Perplexica` | Redireciona para `ItzCrazyKns/Vane`: `git ls-remote` devolve os mesmos refs, então issues e PRs são os mesmos. |

## 1. Fork vs upstream (commits)

| Comparação | À frente (fork) | Atrás (fork) |
| --- | --- | --- |
| `master` do fork (3b3799c) vs `upstream/master` (348feca, 01/09/2026) | **51** | **0** |
| `master` do fork vs `upstream/canary` (0987ee4, 27/12/2025) | 114 | 0 |

- A base comum é o próprio HEAD do upstream (`348feca Update README.md`). O fork tem **todos** os commits do upstream, incluindo os mais recentes, de abr a set/2026: `adc68fc` imagem slim, `e0aac65` breaks no switch do clima (PR #1097), `40a7cde` scrape-url sem estouro de contexto, `ebcf538` Playwright no Docker, `c3ee198` contexto vazio, `b868aa0` `executeSearch` com deep research e gestão de contexto, `cbe538c` scraper, `0e33641` spinner de upload (PR #1082), `72ac815` clima via freeipapi.
- **Não existe nenhum commit do upstream fora do fork**, então não há lista de commits "atrás". O upstream não mescla nenhum PR desde 10/04/2026. Depois disso houve só commits diretos do mantenedor, até 01/09/2026, e o fork já tem todos.
- Os outros branches do upstream (`develop/*`, `feat/*`, `GCP`, `admin-password`) são antigos ou experimentais. Não analisei um a um.
- Portanto, as "correções do upstream que faltam" são **PRs abertos e nunca mesclados**. O PR #3 do fork já trouxe 9 deles: #1161, #1105, #1226, #1225, #1229, #1231, #1055, #1181 e #1088. O #1094 foi descartado porque quebra o build.

### Correções do upstream (PRs abertos) que ainda faltam no fork

Verifiquei cada uma no código do fork.

| PR | O que corrige | Área | Situação no fork (verificada) | Prioridade |
| --- | --- | --- | --- | --- |
| #1168 | Agrupa as chamadas de embedding em `executeSearch`, em vez de N+1 requisições HTTP por busca | busca / embeddings | **Falta.** `baseSearch.ts:52-59` faz `embedText([q])` e depois `embedText([content])` para cada resultado | Alta (latência e carga) |
| #1120 | Volta aos top-10 quando o filtro de similaridade (>0.5) remove todos os resultados ("Found 0 results", issue #1119) | busca | **Falta.** Filtro em `baseSearch.ts:73` | Alta |
| #1038 | No reconnect, manda um snapshot dos blocos em vez de repetir todos os eventos (texto repetido, issue #938) | streaming / sessões | **Falta.** `session.ts:80-95` repete o array `events` inteiro | Alta (bug e memória) |
| #1096 / #1093 / #1054 | Status `error` no banco quando a busca falha; o cliente checa `res.ok` no reconnect, assim o loading não fica preso para sempre | pipeline / UI / DB | **Parcial.** O fork tem o #1105, que emite `error` na sessão, mas: (a) `SearchAgent` não grava `status:'error'` no banco; (b) `useChat.tsx:375` não verifica `res.ok` depois de `/api/reconnect` | Alta |
| #1099 | try/catch no `APISearchAgent`, para `/api/search` não travar | API | **Falta.** `api.ts` não tem try/catch em volta do `classify`/`research` | Alta |
| #1051 | Envia keepalive no SSE a cada 15 s durante gerações longas (LM Studio, issue #1030) | streaming | **Falta** | Média |
| #993 | Timeout configurável para OpenAI e LM Studio | providers | **Falta.** Não há timeout explícito no LLM | Média |
| #1147 (issue) | Embeddings do Ollama sem limite de concorrência (502) | providers / embeddings | **Falta.** Não há p-limit ou semáforo | Média |
| #1091 | Guardas com `Array.isArray` para `urls`/`queries` indefinidos em `scrapeURL`/`uploadsSearch` (issue #964) | busca | **Falta.** `scrapeURL.ts:68` faz `params.urls.slice` sem guarda | Média |
| #1209 | (1) trava com tool call em streaming; (2) versão do `next` diferente no runtime do Docker | providers / Docker | (1) Coberto pelo #1161, já portado. (2) Talvez coberto pelo `5b45cd0` do fork; conferir | Baixa |
| #1176 / #1151 | Variações da guarda do `partial-json` contra argumentos vazios | providers | Coberto pelo #1161 | Feito |
| #1228 | Deduplica fontes por URL normalizada (utm, #fragmento, barra final) | busca | **Falta** | Média (tokens) |
| #1227 | Remove citações `[n]` acima do número de fontes | UI / writer | **Falta** | Baixa |
| #1032 / #1037 / #1042 | Remove cercas markdown antes do `JSON.parse` (issue #959, Claude via LiteLLM/OpenRouter) | providers | **Falta.** Não há tratamento de ``` em `src/lib/models` | Média |
| #1200 | Escapa HTML cru da resposta (XSS) | UI | **Falta.** `MessageBox.tsx:80` `renderRule` não trata HTML | Alta (segurança) |
| #1222 / #1052 / #1145 / #1224 | Scrape só com http(s), recusa IPs privados (SSRF), valida URLs do config | segurança / scraper | **Falta.** `scrapeURL.ts:50` usa `z.array(z.string())` sem esquema; vale também para o Firecrawl e o fetch do fork | Alta (segurança) |
| #1223 | Esconde credenciais no `GET /api/config` (issues #1155/#1122) | segurança | Parcial: `a471fef` parou de logar as chaves e bloqueou prototype pollution, mas o GET ainda devolve as chaves | Alta (segurança) |
| #1214 | Respeita `HTTP(S)_PROXY` (`NODE_USE_ENV_PROXY=1`) | Docker | Falta | Baixa |
| #1035 / #1073 | Limita ou limpa o HTML raspado para gastar menos tokens (issue #1031) | scraper / tokens | Provavelmente coberto: o upstream tem o `40a7cde`, e o fork tem orçamento de contexto (`0899b6a`) e Firecrawl/Readability | Feito / revisar |
| #1053 | Limite no contexto do writer | writer | Coberto pelo `writerContext.ts`/`fitWriterSources` do fork | Feito |
| #1056 | `maxResultsPerQuery` (issue #977) | busca / tokens | Falta | Média |

## 2. Issues e PRs relevantes do upstream (44 itens)

Legenda: "Corrigido upstream" quer dizer código mesclado no master do upstream. "PR aberto" quer dizer que existe uma correção proposta, mas não mesclada.

| # | Tipo | Título (resumido) | Estado | Resumo | Área | Corrigido upstream? | No fork |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1199 | issue | Memory leak: ~40 MB retidos por interação (`next-server`) | aberto | A RAM cresce com o tráfego e chegou a 15,6 GB em 3,7 dias; só reiniciar resolve | pipeline / sessões | Não | Parcial (#1225 resolve o vazamento do Transformers). Ver nota A |
| 1197 | issue | Pipeline trava quando o modelo vaza tokens Harmony (`<\|channel\|>`) | aberto | `/api/search` cai ou fica pendurado sem resposta (gpt-oss) | providers / pipeline | Não | Falta |
| 1174 | issue | Preso em "Brainstorming" com LM Studio + Qwen (skipSearch, conteúdo vazio) | aberto | O classificador pula a busca e o writer devolve vazio | pipeline | PR #1231 aberto | Tem (#1231) |
| 1154 | issue | Upgrade 1.12.1→1.12.2: brainstorming infinito (OpenRouter) | aberto | Fica preso no 1º passo | providers | PRs #1161/#1176/#1209 | Tem (#1161) |
| 1160 | issue | Anthropic: toda busca quebra com "Error: is empty" | aberto | `partial-json` com argumentos vazios | providers | PR #1161 aberto | Tem |
| 1150 | issue | OpenRouter: streaming quebra com argumentos vazios | aberto | Igual ao #1160 | providers | PRs #1151/#1176 | Tem (#1161) |
| 1080 | issue | API inutilizável ("Error: is empty") | aberto | `/api/search` trava | API / providers | PRs #1099/#1161 | Parcial (falta #1099) |
| 1069 | issue | Stuck brainstorming | aberto | Erro engolido, a UI não sai do spinner | pipeline / UI | PR #1105/#1054 | Parcial |
| 1006 | issue | Preso em "Brainstorming"; chats antigos ficam inutilizáveis | aberto | Mensagem fica `answering` no banco e o reconnect dá 404 | DB / UI / reconnect | PR #1096 aberto | **Falta** |
| 1070 | issue | Preso no modo "Quality" | aberto | Estouro de contexto no Quality deixa a mensagem `answering` para sempre | pipeline / DB | PR #1093 aberto | **Falta** |
| 965 | issue | Não consegue buscar (preso em Brainstorming, 18 comentários) | aberto | O sintoma mais comum | pipeline | PR #1054 aberto | Parcial |
| 1143 | issue | Search is broken: 82 resultados e nenhuma resposta | aberto | O pipeline para depois da busca (Gemini) | pipeline | Não | Verificar |
| 1119 | issue | SearXNG externo: "Found 0 results" em Speed/Balanced | aberto | O filtro de similaridade >0.5 descarta tudo | busca / embeddings | PR #1120 aberto | **Falta** |
| 1147 | issue | OllamaEmbedding sem limite de concorrência → 502 | aberto | Inunda o servidor de embedding | providers / embeddings | Não | **Falta** |
| 1168 | PR | Agrupar embeddings no executeSearch (N+1) | aberto | Uma requisição por resultado | busca / embeddings | Não mesclado | **Falta** |
| 1144 | issue | Vane gerou US$ 3000 de cobrança no OpenRouter | aberto | Chamadas Opus inesperadas (auto video search?); não há teto de gasto | providers / custo | Não | Falta (sem limite de custo; Bifrost pode ajudar) |
| 1031 | issue | 481k tokens para resumir uma página | aberto | Página inteira em markdown vai para o LLM | scraper / discover | Parcial (`40a7cde`); PRs #1035/#1073 | Provavelmente coberto (orçamento de contexto + Readability) |
| 977 | issue | Controlar os tokens gerados pela busca (>500K) | aberto | Pede limite de resultados por query | busca / tokens | PR #1056 aberto | Falta |
| 1011 | issue | "exceeds the available context size" | aberto | Contexto do writer estoura | pipeline / writer | PR #1053 aberto | Coberto (`0899b6a`) |
| 981 | issue | Contexto do Ollama fixo no código | aberto | num_ctx fixo em 32000 | providers | PR #1088 aberto | Tem |
| 1030 | issue | Desconecta do LM Studio antes de terminar | aberto | Processamento longo (~5 min) é cortado | streaming / providers | PRs #1051/#993 | **Falta** |
| 938 | issue | Texto repetido nas respostas | aberto | O reconnect repete todos os patches | streaming / sessões | PR #1038 aberto | **Falta** |
| 1132 | issue | Imagem Docker de 8 GB | aberto | Camada do Playwright com 596 MB e mais | Docker | Parcial (`adc68fc` slim) | Melhor: Playwright removido (`0b80355`, `5b45cd0`) |
| 1121 | issue | Imagem Docker enorme (3 GB, 13 GB depois do pull) | aberto | Pede imagem menor e composável | Docker | Não | Parcial |
| 1101 | issue | Playwright falta no Dockerfile.slim | fechado | O scrape quebrava no slim | Docker | Sim (`ebcf538`) | N/A (fork sem Playwright) |
| 858 | issue | SearXNG botdetection: falta X-Forwarded-For | aberto | O SearXNG bloqueia as buscas | busca | PR #1055 aberto | Tem |
| 964 | issue | TypeError: lendo `slice` de undefined | aberto | Tool call sem `queries`/`urls` (LiteLLM) | busca | Parcial (#1076 mesclado); PR #1091 | Parcial (falta a guarda em scrapeURL/uploads) |
| 1075 | issue | `t.searching.map is not a function` | fechado | `searching` não era array | UI | Sim (PR #1076) | Tem |
| 959 | issue | Erro de parse do JSON com Claude via LiteLLM/OpenRouter | aberto | O modelo devolve JSON dentro de ```json | providers | PRs #1032/#1037/#1042 | **Falta** |
| 980 / 1061 | issue | Groq quebrado (json_schema / schema do web_search) | aberto | Incompatibilidade de schema | providers | PRs #1050/#1116 | Falta |
| 1185 | issue | unhandledRejection: fetch failed (Ollama) | aberto | Erro de rede vira brainstorming infinito | providers | PR #1189 aberto | Parcial (#1105) |
| 1186 | issue | chatModels zerados ao reiniciar (Anthropic) | aberto | O config é sobrescrito no boot | config | Não | Verificar |
| 1172 / 997 | issue | Erros não aparecem no frontend; logs pobres | aberto | Difícil de depurar | UI / logs | PR #1090 | Parcial |
| 973 | issue | Não consulta a web | aberto | O classificador pula a busca | pipeline / classificador | PR #1003 | Verificar |
| 1064 | issue | Não envia PDF | fechado | Spinner preso | uploads | Sim (PR #1082) | Tem |
| 1155 / 1122 | issue | API key vazando no `GET /api/config` + SSRF | aberto | Sem autenticação | segurança | PRs #1223/#1224/#1145 | Parcial (`a471fef`) |
| 1079 | issue | `/api/config` sem autenticação, leitura e escrita | fechado (completed) | Mesmo problema | segurança | Fechado sem mudança clara no código | Parcial |
| 1200 | PR | Escapar HTML cru (XSS) | aberto | `markdown-to-jsx` renderiza HTML do modelo | UI / segurança | Não mesclado | **Falta** |
| 1222 | PR | Scrape só http(s), sem destinos privados | aberto | `file:///etc/passwd` e redirect para loopback | scraper / segurança | Não mesclado | **Falta** |
| 1015 | PR | Timeout de 10 s no SearXNG + widgets resilientes | mesclado | Evita trava com SearXNG lento | busca | Sim | Tem (`searxng.ts:44`) |
| 1228 | PR | Deduplicar fontes por URL normalizada | aberto | Mesma página aparece 2 vezes e é raspada 2 vezes | busca / tokens | Não mesclado | **Falta** |
| 1209 | PR | Pesquisa trava com tool call em streaming + versão do next no Docker | aberto | Igual ao #1161 + drift do Docker | providers / Docker | Não mesclado | Parcial |
| 759 | issue | App congela: "Failed to calculate number of tokens" | aberto (antigo) | tiktoken/contagem de tokens | pipeline | Não | Verificar (`getTokenCount` é usado no fork) |
| 503 | issue | Chamadas de API ficam penduradas no Docker | aberto (antigo) | Sem resposta e sem erro | API | Relacionado ao #1099 | **Falta** |
| 464 | issue | Como reduzir a latência? | fechado | Pergunta geral | pipeline | N/A | N/A |

### Notas de auditoria (código do fork)

- **A. Memória (#1199).** O `SessionManager` (`src/lib/session.ts`) guarda cada sessão num `Map` global com `setTimeout` de 30 min. Cada sessão mantém o array `events`, com todos os patches, e um `Map` de `blocks`. Os blocos de pesquisa incluem `metadata.embedding` de cada resultado (`baseSearch.ts`), ou seja, vetores de centenas ou milhares de floats por resultado. Isso fica na memória por 30 min, mesmo depois do `end`. O `APISearchAgent` cria uma sessão extra (`SessionManager.createSession()` em `api.ts`) por chamada, com o mesmo TTL. Somado ao replay sem snapshot (#1038), isso explica bem a retenção de cerca de 40 MB por interação. Sugestões: apagar a sessão (ou encurtar o TTL) depois do `end`/`error`, `clearTimeout`, e não guardar `embedding` nos blocos que vão para o cliente.
- **B. Latência.** Embeddings N+1 (#1168), sem limite de concorrência (#1147) e sem timeout no LLM (#993).
- **C. Travas.** Falta gravar `status:'error'` no banco e o cliente não checa `res.ok` no reconnect (#1096/#1093). Também falta try/catch no `APISearchAgent` (#1099).

## 3. DeepWiki: arquitetura do pipeline de busca (ItzCrazyKns/Vane)

Páginas do wiki: Overview, Architecture (Search and Chat Pipeline, Model Provider System, Data Persistence, Session Management), API Reference, Backend Systems (Search Agent, Researcher and Research Actions, Model Abstractions, SearXNG Integration) e outras.

### Resumo do que o DeepWiki diz

| Tema | Upstream segundo o DeepWiki | Diferença provável no fork |
| --- | --- | --- |
| Entrada | `POST /api/chat` → `SearchAgent`; `/api/search` → `APISearchAgent`, que reaproveita o classificador e o researcher, sem blocos | O fork tem a rota extra `POST /api/benchmark` (NDJSON) e instrumentação (`src/lib/benchmark/instrument.ts`) |
| Classificador | Um LLM decide `skipSearch`, os widgets e reescreve a pergunta como standalone | O fork tem o #1231: quando pula a busca, o modelo responde normalmente. Também responde e busca no idioma do usuário (`64a539a`) |
| Modos | speed `maxIteration=2`, balanced 6, quality 25; quality usa a tool `__reasoning_preamble` | Mesmos valores no `researcher/index.ts` (verificar se mudaram) |
| Ações | `ActionRegistry`: web_search, academic, social, uploads_search, scrape_url, done | O fork acrescenta `mcp.ts` (ferramentas MCP) e `plan.ts`. **O DeepWiki não fala de MCP**, então os riscos de tempo e tokens das ferramentas MCP são só do fork |
| Busca | `searchSearxng` com timeout de 10 s (AbortController) | O fork pode buscar via **Firecrawl** (`firecrawlSearch.ts`, com timeout) e manda X-Forwarded-For ao SearXNG |
| Embeddings / rerank | Speed/balanced: embedding da query e de cada resultado, cosseno, corte em <0.5, ordena por similaridade, remove duplicatas >0.75 | Igual no fork (`baseSearch.ts`), com o mesmo N+1 e o mesmo risco de 0 resultados |
| Quality / deep research | `executeSearch` raspa os resultados ainda não lidos, faz `splitText` (4000 tokens, overlap de 500) e extrai fatos com LLM | No fork, a raspagem é **Firecrawl + fetch/Readability**, não Playwright. O DeepWiki diz Playwright (20 s de navegação, 5 s de load state), o que já não vale para o fork |
| Contexto do writer | O DeepWiki **não encontrou** limite explícito do contexto do writer | O fork tem orçamento de contexto (`writerContext.ts`, `fitWriterSources`, `0899b6a`). Diferença importante |
| Uploads | `splitText` (512/128 tokens), embedding de cada chunk | Igual; `uploads/manager.ts` com extensão sanitizada (`a471fef`) |
| Tokens | `js-tiktoken` `cl100k_base` | Igual (`getTokenCount`) |
| Streaming | `SessionManager` como barramento de eventos; blocos + patches RFC6902 (`updateBlock`); NDJSON sobre a resposta HTTP | Igual |
| Sessões / reconnect | TTL de 30 min; `POST /api/reconnect/[id]` repete **todos** os eventos | Igual. O fork corrigiu o TDZ e o double-close (`a471fef`), mas mantém o replay completo e o TTL fixo |
| Providers / tool calls | OpenAI e Ollama fazem streaming de tool calls; Anthropic, Groq, Gemini, LM Studio e Lemonade estendem o OpenAI | O fork tem guarda contra argumentos vazios (#1161) e o gateway **Bifrost** (`src/lib/bifrost.ts`, atrás de uma flag de configuração), uma camada a mais de latência e de falhas que o DeepWiki não cobre |
| Timeouts | SearXNG 10 s, scraper 20 s; **não há timeout global de LLM** | Igual para o LLM. O fork tem timeouts no Firecrawl, no MCP (`mcp/client.ts`), no RSS do discover e no lookup do LM Studio |
| Riscos citados | Quality com até 25 iterações (latência e custo); custo dos embeddings; memória do array `events` | Os mesmos, mais o loop MCP e o Firecrawl |

### Pontos para checar no fork por causa do DeepWiki

1. Não há timeout global no LLM (upstream e fork). Com Bifrost no meio, um provider pendurado prende a sessão e a memória por até 30 min.
2. O replay de `events` cresce sem limite com as iterações do quality (até 25) e mais as ferramentas MCP.
3. As ferramentas MCP e o Firecrawl entram no orçamento de contexto? Confirmar se `fitWriterSources` cobre a saída do MCP.
