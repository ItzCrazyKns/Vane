# Ferramentas disponíveis nesta sessão

Levantado em 06/11/2026, no início da auditoria. "OK" quer dizer que a ferramenta foi usada ou testada nesta rodada.

## Conectores (MCP)

| Pedido no roteiro | Situação | Uso / alternativa |
|---|---|---|
| GitHub | OK (escrita só em `module195/Vane`; leitura de repositórios públicos como o upstream) | Comparação com `ItzCrazyKns/Vane`, issues e PRs do upstream. Busca via `gh api search/*`. |
| DeepWiki | Disponível | Conferir a arquitetura com a visão do upstream. O fork não está indexado; uso `ItzCrazyKns/Vane`. |
| Context7 | **Falhou ao conectar** (erro de túnel no proxy) | Alternativa: tipos e código das bibliotecas em `node_modules` e docs oficiais por busca na web (Tavily, Parallel). |
| Exa | **Falhou ao conectar** (erro de túnel no proxy) | Alternativa: Tavily e Parallel, Pipeworx (versões de pacotes npm) e `yarn audit`. |
| Chrome DevTools (plugin ECC) | Instável: conecta e desconecta nesta sessão | Alternativa estável: Playwright com o Chromium do container (traces, métricas, console, rede) e `npx lighthouse` com o mesmo Chromium. |
| Seu Mac (pastas e Chrome) | Desconectado | Só se você reconectar. O modelo local fixo roda no seu Mac. |
| Tavily, Parallel, Pipeworx, Hacker News, Reddit, arXiv, Wikidata | Disponíveis | Problemas conhecidos nas versões exatas das dependências; discussões sobre Vane/Perplexica. |
| Claude Docs / Artifacts | Disponíveis | Relatórios longos, se você preferir em vez de `.md`. |

## Agentes

Todos os citados existem: `code-explorer`, `architect`, `e2e-runner`, `performance-optimizer`, `silent-failure-hunter`, `typescript-reviewer`, `react-reviewer`, `security-reviewer` e `code-simplifier` (plugin ECC), além de `Explore`, `Plan` e `general-purpose`.

## Skills

Todas as citadas existem: `codebase-onboarding`, `repo-scan`, `code-tour`, `ai-regression-testing`, `eval-harness`, `e2e-testing`, `tdd-workflow`, `benchmark`, `benchmark-methodology`, `benchmark-optimization-loop`, `backend-patterns`, `latency-critical-systems`, `data-throughput-accelerator`, `react-performance`, `nextjs-turbopack`, `frontend-patterns`, `docker-patterns`, `error-handling`, `click-path-audit`, `browser-qa`, `cost-aware-llm-pipeline`, `prompt-caching-strategy`, `token-budget-advisor`, `refactor-clean`, `conventional-commit-review`, `github-ops`, os comandos `pr`, `orch-review` e `code-review`, e as skills de processo `superpowers:writing-plans`, `systematic-debugging`, `test-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `verification-before-completion` e `requesting-code-review`.

`code-simplifier` existe como agente, não como skill.

## Ambiente

- Container Linux com 4 CPUs, 15 GB de RAM e sem GPU. Node 22, Yarn 1.22, Docker 29 (daemon iniciado manualmente).
- A rede passa por um proxy que só aceita HTTPS. Para o `docker build` funcionar, usei cópias dos Dockerfiles (fora do repositório) que confiam no certificado do proxy e trocam o apt para HTTPS. Os Dockerfiles do projeto não foram alterados.
- Não há Ollama nem LM Studio aqui. O modelo fixo da avaliação roda no seu computador ou num endpoint que você indicar.
