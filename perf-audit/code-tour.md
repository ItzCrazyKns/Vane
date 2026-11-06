# Roteiro de leitura do código do Vane

Ordem pensada para quem vai mexer na busca. Cada parada traz `arquivo:linha`, o que olhar e por quê. Para o contexto e os diagramas, veja `architecture.md`. Nada aqui foi executado; é leitura de código.

## Parte A. Entrada e infraestrutura

**1. `package.json:6-15,41,80`.** Olhe os scripts: build com `next build --webpack`, `test` com vitest, `lint` ainda `next lint`. Por que importa: mostra o que existe de verdade (testes, `i18n:check`) e que o lockfile é yarn.

**2. `src/instrumentation.ts:1-13`.** Olhe a ordem: migrações, depois a importação de `config/index`, só em runtime Node (`:2`). Por que importa: é tudo o que roda "ao iniciar" além do Next; falha de migração só é logada (`:7-9`).

**3. `src/lib/db/schema.ts:6-38` e `src/lib/db/migrate.ts:12-60,117-130`.** Olhe as duas tabelas sem índice e o runner à mão. Os arquivos `drizzle/0001_*.sql` e `0002_*.sql` são comentários vazios; a lógica real está em `migrate.ts`. Por que importa: qualquer mudança de schema passa por aqui, e o índice em `messages.chatId` seria o primeiro ajuste.

**4. `src/lib/config/index.ts:8-25,235-283,294-370,372-384,525`.** Olhe o singleton: lê o arquivo uma vez, `getConfig` só lê memória, `saveConfig` reescreve tudo (`:244`), e a semeadura de env para provedores, busca e Bifrost. Por que importa: explica por que mudar `config.json` na mão exige reiniciar e por que env vars só valem na primeira vez.

**5. `src/lib/config/serverRegistry.ts:4-68`.** Olhe `getSearchProvider`, `getFirecrawlURL` e `getBifrostConfig`. Por que importa: são os únicos pontos de leitura de config no servidor; o código de busca e MCP depende deles.

## Parte B. Modelos

**6. `src/lib/models/registry.ts:18-66,105-123`.** Olhe `new ModelRegistry()` recriado por requisição, o Bifrost acrescentado em `addBifrostProvider` e `loadChatModel`. Por que importa: cada requisição reinstancia os provedores, e `loadChatModel` pode disparar HTTP (ver parada 7).

**7. `src/lib/models/providers/anthropic/index.ts:60-86` (comparar com `openai/index.ts:138-181` e `bifrost/index.ts:51-59`).** Olhe que `loadChatModel` chama `getModelList()` e que Anthropic faz um GET sem timeout (`:32`), enquanto o OpenAI padrão usa lista fixa e o Bifrost nem consulta. Por que importa: é latência escondida antes de o stream abrir.

**8. `src/lib/models/providers/openai/openaiLLM.ts:129-204,206-239`.** Olhe `temperature ?? 1.0` (`:149-150,210-211`), ausência de `max_completion_tokens`, o `stream: true` e a conversão de `tool_calls` parciais com `partial-json`. Por que importa: quase todos os provedores herdam esta classe; é aqui que se define o comportamento real de temperatura, tokens e erros. Compare com `ollamaLLM.ts:22-25,104-107` (0,7 e `num_ctx`).

**9. `src/lib/bifrost.ts:14-30,57-72` e `src/lib/models/providers/bifrost/index.ts:29-59`.** Olhe o cabeçalho `x-bf-mcp-include-tools`, a separação de embeddings por regex e a reutilização das classes OpenAI. Por que importa: é como o gateway entra sem classes novas, e como o Vane impede o Bifrost de injetar ferramentas.

## Parte C. Do clique ao stream

**10. `src/app/layout.tsx:1,36-60`.** Olhe `force-dynamic`, a leitura de config no servidor e o `ChatProvider` envolvendo tudo. Por que importa: define que o estado do chat vive acima das páginas e que o setup bloqueia o app.

**11. `src/lib/hooks/useChat.tsx:664-756` e `:501-662`.** Olhe `sendMessage` (POST + reader + split por linha) e o `messageHandler` com `block`, `updateBlock`, `researchComplete`, `messageEnd`. Note a repetição do buffer em erro de parse (`:744-754`) e as sugestões pedidas só depois do fim (`:633-641`). Por que importa: é o lado cliente do protocolo e o ponto de custo por token (`:565-580`).

**12. `src/app/api/chat/route.ts:103-256`.** Olhe a carga paralela dos modelos antes do stream (`:130-136`), o `agent.searchAsync` sem `await` (`:213`), `ensureChatExists` sem `await` (`:228`) e o `abort` que só desliga o listener (`:235-240`). Por que importa: mostra o que é síncrono, o que corre solto e por que fechar a aba não cancela nada.

**13. `src/lib/session.ts:5-103`.** Olhe o `Map` global, o TTL de 30 min (`:17,22-24`), `emit` guardando todo evento (`:45-48`) e o replay em `subscribe` (`:92-95`). Por que importa: é a base do reconnect e a causa da retenção quadrática de memória.

## Parte D. O agente

**14. `src/lib/agents/search/index.ts:29-220`.** Leia de cima a baixo: gravação da mensagem (`:30-68`), classificação (`:70`), `Promise.all` de widgets e pesquisa (`:108`), `fitWriterSources` (`:137-149`), o laço de streaming com texto acumulado (`:175-203`) e o `UPDATE` final (`:207`). Por que importa: é o fluxo inteiro em um arquivo; também onde o erro vira evento `error` sem tocar o banco (`:16-26`).

**15. `src/lib/agents/search/classifier.ts:30-53` e `src/lib/prompts/search/classifier.ts:1`.** Olhe o schema (`skipSearch`, widgets, `standaloneFollowUp`) e que `enabledSources` não entra no prompt. Por que importa: o classificador decide se há pesquisa, e a reescrita só chega ao pesquisador.

**16. `src/lib/agents/search/researcher/index.ts:21-265`.** Olhe os tetos por modo (`:26-31`), `syncMCPActions` (`:33`), o cálculo de orçamento (`:72`), a compactação (`:96-111`), o laço de streaming com o plano em tempo real (`:131-193`), a saída em `done` (`:195-201`) e a deduplicação por URL antes do bloco `source` (`:234-259`). Por que importa: é o coração do comportamento por modo.

**17. `src/lib/agents/search/researcher/actions/registry.ts:88-107`, `actions/index.ts:10-16` e `actions/plan.ts:25-38`.** Olhe como cada ação decide `enabled`, a execução paralela com ordem preservada e o plano desligado em speed (`plan.ts:31`). Por que importa: é o ponto de extensão para novas ferramentas.

## Parte E. Busca, páginas e contexto

**18. `src/lib/agents/search/researcher/actions/search/baseSearch.ts:38-172`.** Olhe o ramo speed/balanced: busca em paralelo, um embedding por resultado (`:59`), limite de similaridade 0,5 (`:73`), fallback sem rerank (`:74-87`) e dedup quadrático (`:135-159`). Por que importa: é o maior gasto de embeddings e o ponto de maior ganho possível (lote).

**19. `baseSearch.ts:173-421` e `src/lib/scraper.ts:34-161`.** Olhe o ramo quality: seletor LLM (`:273`), filtro de URLs já lidas (`:292-304`), `Scraper.scrape`, `splitText` e extratores sem limite de concorrência (`:366-403`). No scraper, Firecrawl 60 s versus `fetch` 20 s e o contrato "nunca lança" (`scraper.ts:31,55-67`). Por que importa: é onde o tempo de cada iteração em quality se decide.

**20. `src/lib/webSearch.ts:10-13`, `src/lib/firecrawlSearch.ts:31-115` e `src/lib/searxng.ts:23-76`.** Olhe o despachante, a tradução das opções SearxNG para Firecrawl (`firecrawlSearch.ts:31-58`) e o timeout de 10 s do SearxNG (`searxng.ts:44`). Por que importa: mostra o contrato comum `{results, suggestions}` e o que se perde ao trocar de provedor (mídia e Discover continuam no SearxNG).

**21. `src/lib/context/budget.ts:5-77`, `src/lib/context/compact.ts:91-204` e `src/lib/agents/search/writerContext.ts:22-52`.** Olhe a janela de 32 000 por padrão, o fator 1,2, as reservas de saída (`budget.ts:22-25`), o limiar de 75% (`compact.ts:105`) e o `fitSourcesToBudget` que preserva a ordem. Por que importa: decide quanto contexto o redator recebe; leia junto com `models/base/llm.ts:26-28` para ver por que cloud cai em 32 mil.

**22. `src/lib/agents/search/researcher/actions/mcp.ts:31-167` e `src/lib/mcp/client.ts:45-141`.** Olhe o gate por Bifrost (`:31-43`), allow list contra `readOnlyHint` (`:58-61`), truncamento a 8000 caracteres (`:70`), o cache de 60 s (`:133-167`) e o cliente JSON-RPC com SSE de uma resposta (`client.ts:26-43,56-91`). Por que importa: é a única ferramenta externa dinâmica e quase não tem código além disso.

## Parte F. Recursos laterais

**23. `src/lib/uploads/manager.ts:177-218` e `src/lib/uploads/store.ts:53-97`.** Olhe o fluxo de gravação e embedding em lote, o local `data/uploads` (`manager.ts:34`) e o hash com a nota (`store.ts:74`) que impede o RRF de somar. Por que importa: é o bug de qualidade mais concreto da lista, junto com a releitura de disco a cada iteração (`prompts/search/researcher.ts:332`).

**24. `src/lib/discover/fetchTopic.ts:106-165`, `src/lib/discover/cache.ts:12-59` e `src/lib/discover/rss.ts:5-7,144-157`.** Olhe RSS primeiro, SearxNG se houver menos de 8 itens, merge e cache com serviço de valor vencido em erro. Por que importa: é o único recurso que ganhou cache de verdade e dá o padrão a seguir para o resto.

**25. `src/app/api/search/route.ts:19-208` e `src/lib/agents/search/api.ts:11-120`.** Olhe a ausência de `try/catch` em `searchAsync` (`api.ts:11`) e o `agent.searchAsync` sem captura na rota (`route.ts:54`). Por que importa: é onde um erro de LLM provavelmente deixa a requisição pendente.

## Parte G. Interface e medição

**26. `src/components/MessageBox.tsx:77-190`, `src/components/Chat.tsx:63-80` e `src/lib/utils/citations.ts:7-64`.** Olhe os estados de espera (`MessageBox.tsx:148-178`, `Chat.tsx:80`), `Markdown` re-interpretando o texto inteiro (`:182-190`) e a troca de `[n]` por `<citation>`. Por que importa: mostra onde o usuário espera sem conteúdo e onde o custo por token do cliente aparece.

**27. `src/lib/benchmark/instrument.ts:64-215` e `src/lib/benchmark/runner.ts:47-136`.** Olhe os wrappers que medem sem alterar chamadas e o rastreio de `fetch` por `AsyncLocalStorage` (`instrument.ts:217-294`). Por que importa: é a ferramenta que a próxima fase deve usar para medir o que este documento só estima.

## Parte H. Empacotamento

**28. `Dockerfile:1-78`, `Dockerfile.slim:1-39`, `entrypoint.sh:1-32` e `docker-compose.yaml:1-14`.** Olhe o estágio de build, o `standalone` copiado sem `yarn install` (`Dockerfile:29-37`), o clone do HEAD do SearxNG (`:57-58`), o `sleep 5` e o Flask de desenvolvimento (`entrypoint.sh:6,10`), o volume `vane-data`. Por que importa: é tudo o que muda entre a imagem completa e a slim, e o que roda ao iniciar.

Fora do roteiro: `src/__tests__/helpers/fakes.ts` e `src/lib/agents/search/__tests__/pipeline.test.ts` mostram como o pipeline é testado; não li o conteúdo, só confirmei que existem.