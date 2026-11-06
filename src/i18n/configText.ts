'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import type { Locale } from './config';

/**
 * Settings fields (and provider connection fields) are defined on the server
 * in English. This map translates their labels, descriptions and placeholders
 * on the client, falling back to the original text when no entry exists.
 */
const configText: Partial<Record<Locale, Record<string, string>>> = {
  'pt-BR': {
    Theme: 'Tema',
    Light: 'Claro',
    Dark: 'Escuro',
    'Choose between light and dark layouts for the app.':
      'Escolha entre o tema claro e o escuro para o aplicativo.',
    'Measurement Unit': 'Unidade de medida',
    Imperial: 'Imperial',
    Metric: 'Métrico',
    'Choose between Metric  and Imperial measurement unit.':
      'Escolha entre o sistema métrico e o imperial.',
    'Auto video & image search': 'Busca automática de vídeos e imagens',
    'Automatically search for relevant images and videos.':
      'Buscar automaticamente imagens e vídeos relevantes.',
    'Show weather widget': 'Mostrar widget de clima',
    'Display the weather card on the home screen.':
      'Exibir o cartão de clima na tela inicial.',
    'Show news widget': 'Mostrar widget de notícias',
    'Display the recent news card on the home screen.':
      'Exibir o cartão de notícias recentes na tela inicial.',
    'System Instructions': 'Instruções do sistema',
    'Add custom behavior or tone for the model.':
      'Adicione um comportamento ou tom personalizado para o modelo.',
    'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."':
      'ex.: "Responda em um tom amigável e conciso" ou "Formate as respostas em tópicos."',
    'SearXNG URL': 'URL do SearXNG',
    'The URL of your SearXNG instance': 'A URL da sua instância do SearXNG',
    'Search Provider': 'Provedor de busca',
    'Engine used for web searches. Firecrawl needs the Firecrawl URL below.':
      'Mecanismo usado nas buscas na web. O Firecrawl precisa da URL do Firecrawl abaixo.',
    'Firecrawl URL': 'URL do Firecrawl',
    'Base URL of your Firecrawl API, without /v2. Used for web search when Firecrawl is the provider, and for reading pages.':
      'URL base da API do Firecrawl, sem /v2. Usada na busca quando o Firecrawl é o provedor e na leitura de páginas.',
    'Use Bifrost': 'Usar o Bifrost',
    'Route models through a Bifrost gateway. Its models appear as the "Bifrost" provider in the model picker.':
      'Encaminha os modelos por um gateway Bifrost. Os modelos dele aparecem como o provedor "Bifrost" no seletor de modelos.',
    'Bifrost URL': 'URL do Bifrost',
    'Base URL of your Bifrost gateway, without /v1. Vane calls /v1/models, /v1/chat/completions and /mcp under it.':
      'URL base do seu gateway Bifrost, sem /v1. O Vane chama /v1/models, /v1/chat/completions e /mcp a partir dela.',
    'Bifrost Virtual Key': 'Chave virtual do Bifrost',
    'Sent as x-bf-vk. Leave empty if your gateway does not require a virtual key.':
      'Enviada como x-bf-vk. Deixe vazio se o seu gateway não exige chave virtual.',
    'Use Bifrost MCP tools': 'Usar ferramentas MCP do Bifrost',
    'Let the researcher call tools from the MCP servers connected to Bifrost (through its /mcp endpoint).':
      'Permite que a pesquisa chame ferramentas dos servidores MCP conectados ao Bifrost (pelo endpoint /mcp).',
    'Allowed MCP tools': 'Ferramentas MCP permitidas',
    'Comma-separated tool names, * works as a wildcard (e.g. "brave-*,github-search_code"). When empty, only tools marked read-only are used.':
      'Nomes de ferramentas separados por vírgula, com * como curinga (ex.: "brave-*,github-search_code"). Vazio usa só as ferramentas marcadas como somente leitura.',
    'API Key': 'Chave de API',
    'Base URL': 'URL base',
    'Your Anthropic API key': 'Sua chave de API da Anthropic',
    'Your Gemini API key': 'Sua chave de API do Gemini',
    'Your Groq API key': 'Sua chave de API da Groq',
    'Your OpenAI API key': 'Sua chave de API da OpenAI',
    'Your Lemonade API key (optional)':
      'Sua chave de API do Lemonade (opcional)',
    'The base URL for the OpenAI API': 'A URL base da API da OpenAI',
    'The base URL for Lemonade API': 'A URL base da API do Lemonade',
    'The base URL for LM Studio server': 'A URL base do servidor do LM Studio',
    'The base URL for the Ollama': 'A URL base do Ollama',
    'Anthropic API Key': 'Chave de API da Anthropic',
    'Gemini API Key': 'Chave de API do Gemini',
    'Groq API Key': 'Chave de API da Groq',
    'OpenAI API Key': 'Chave de API da OpenAI',
    'Lemonade API Key': 'Chave de API do Lemonade',
    'OpenAI Base URL': 'URL base da OpenAI',
  },
};

export const useConfigText = () => {
  const locale = useLocale();
  return useCallback(
    (text?: string) => (text ? (configText[locale]?.[text] ?? text) : text),
    [locale],
  );
};
