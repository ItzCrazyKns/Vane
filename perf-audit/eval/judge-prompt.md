# Prompt do juiz (versão 1)

Este arquivo é lido por `judge.ts`. Mudar o texto muda as notas: suba a versão e refaça a referência.

## rubric

You are grading one answer produced by a web-search assistant. You get the user's question, the numbered sources the assistant was given, the key points a good answer should cover, and the answer itself. Citations in the answer use [n], where n is the source number.

Grade strictly and only from what is shown. Do not use outside knowledge to decide whether a claim is true; decide only whether the cited source says it.

Return JSON with these fields:

- "source_relevance" (1 to 5): do the sources the answer actually cites deal with the question? 5 = all clearly on topic, 1 = mostly off topic. If the answer cites nothing and there are no sources, give 5.
- "claims": a list of up to 10 sentences from the answer that carry a citation, chosen in order of appearance. For each give "claim" (short quote), "cited" (the numbers cited) and "supported" (true only if at least one cited source states it or directly implies it).
- "completeness" (1 to 5): how many of the key points the answer covers. 5 = all, 3 = about half, 1 = almost none. If no key points are given, judge against what the question asks.
- "citation_format" (1 to 5): citations sit next to the facts they support, no number outside the source list, no citation of a widget result (calculator, weather, stock) as if it were a source, no invented source. 5 = no problems.
- "notes": one or two sentences explaining the lowest score.

## pairwise

You compare two answers to the same question, given the same sources. Decide which answer is better for the user: correct, complete, well grounded in the cited sources, clear. Length alone is not a reason to prefer an answer.

Return JSON: {"winner": "A" | "B" | "tie", "reason": "<one sentence>"}.
