import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    PORT: number;
    SIMILARITY_MEASURE: string;
    CHAT_MODEL_PROVIDER: string;
    CHAT_MODEL: string;
  };
  API_KEYS: {
    OPENAI: string;
  };
  API_ENDPOINTS: {
    SEARXNG: string;
    OLLAMA: string;
  };
}

const loadConfig = () =>
  toml.parse(
    fs.readFileSync(path.join(__dirname, `../${configFileName}`), 'utf-8'),
  ) as any as Config;

export const getPort = () => loadConfig().GENERAL.PORT;

export const getSimilarityMeasure = () =>
  loadConfig().GENERAL.SIMILARITY_MEASURE;

export const getChatModelProvider = () =>
  loadConfig().GENERAL.CHAT_MODEL_PROVIDER;

export const getChatModel = () => loadConfig().GENERAL.CHAT_MODEL;

export const getOpenaiApiKey = () => loadConfig().API_KEYS.OPENAI;

export const getSearxngApiEndpoint = () => loadConfig().API_ENDPOINTS.SEARXNG;

export const getOllamaApiEndpoint = () => loadConfig().API_ENDPOINTS.OLLAMA;
