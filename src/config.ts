import fs from 'fs';
import path from 'path';
import toml, { JsonMap } from '@iarna/toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    PORT: number;
    SIMILARITY_MEASURE: string;
  };
  API_KEYS: {
    OPENAI: string;
  };
  API_ENDPOINTS: {
    SEARXNG: string;
  };
}

const loadConfig = () =>
  toml.parse(
    fs.readFileSync(path.join(process.cwd(), `${configFileName}`), 'utf-8'),
  ) as any as Config;

export const getPort = () => loadConfig().GENERAL.PORT;

export const getSimilarityMeasure = () =>
  loadConfig().GENERAL.SIMILARITY_MEASURE;

export const getOpenaiApiKey = () => loadConfig().API_KEYS.OPENAI;

export const getSearxngApiEndpoint = () => loadConfig().API_ENDPOINTS.SEARXNG;
