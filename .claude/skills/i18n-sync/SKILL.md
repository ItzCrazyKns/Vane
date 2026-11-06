---
name: i18n-sync
description: Use when adding, changing, renaming or removing user-facing text in Vane (components, pages, toasts, settings labels). Keeps src/i18n/messages/en.json and pt-BR.json in sync and runs the key-parity check.
---

# i18n-sync

Vane ships two locales through `next-intl`: `pt-BR` (default) and `en`
(`src/i18n/config.ts`). Every UI string lives in both
`src/i18n/messages/en.json` and `src/i18n/messages/pt-BR.json`, under the same
key path. This skill is the checklist for keeping them in step.

## Where text goes

| Text                                                                                                                                                            | Where it lives                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Component or page text                                                                                                                                          | `messages/{en,pt-BR}.json`, read with `useTranslations('Namespace')` (client) or `getTranslations('Namespace')` (server)              |
| Settings and provider field labels, descriptions, placeholders defined in `ConfigManager` (`src/lib/config/index.ts`) or a provider's `getProviderConfigFields` | Stay in English at the source; add the pt-BR string to the `'pt-BR'` map in `src/i18n/configText.ts`, keyed by the exact English text |
| LLM prompts (`src/lib/prompts/`)                                                                                                                                | Stay in English. They tell the model to answer in the user's language; do not translate them                                          |

Never hard-code user-facing text in JSX, `toast(...)`, `aria-label`, `title`
or `placeholder`.

## Steps

1. **Pick the namespace.** Namespaces are top-level keys named after the
   component or feature (`DeleteChat`, `Library`, `Settings`, `Benchmark`...).
   Reuse the existing one for the component you are editing; reuse `Common`
   for generic words (Cancel, Save, Delete) instead of duplicating them. Add a
   new namespace only for a new component or feature.
2. **Add the key to both files in the same edit**, at the same position in
   each so diffs stay readable. Keys are camelCase; nest at most one extra
   level (`Benchmark.col.search`).
3. **Write real pt-BR**, not a placeholder or a copy of the English. Use the
   tone already in `pt-BR.json`: "você", short imperative labels ("Salvar",
   "Excluir conversa"), sentence case.
4. **Keep ICU arguments identical.** `{count}`, `{name}`, and
   `{count, plural, one {...} other {...}}` must use the same argument names
   and types in both files. Translate only the text inside the option bodies.
   `#` in a plural body is the number.
5. **Use it in code**:
   ```tsx
   const t = useTranslations('Library');
   t('chatCount', { count: chats.length });
   ```
   `src/i18n/global.d.ts` types messages from `en.json`, so a key missing from
   `en.json` fails `tsc`/`next build`. Nothing type-checks `pt-BR.json`, which
   is why step 6 exists.
6. **Run the check** and fix every error before finishing:
   ```bash
   yarn i18n:check
   ```
   It reports keys missing or extra in either file, string/object mismatches,
   empty values, and ICU arguments that differ. It also warns about pt-BR
   values identical to English. If such a value is correct in Portuguese (a
   brand, "Web", "Beta"), add its key to `SAME_OK` in
   `.claude/skills/i18n-sync/scripts/check-keys.mjs`; otherwise translate it.
7. **When removing or renaming a key**, delete or rename it in both files and
   grep for leftover uses: `grep -rn "'oldKey'" src`.

## Done when

- `yarn i18n:check` passes with no errors.
- The changed screen reads correctly in both locales (switch with the
  `NEXT_LOCALE` cookie or the language setting).
