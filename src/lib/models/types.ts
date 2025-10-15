type Model = {
  name: string;
  key: string;
};

type ModelList = {
  embedding: Model[];
  chat: Model[];
};

type ProviderMetadata = {
  name: string;
  key: string;
};

type MinimalProvider = {
  id: string;
  name: string;
  chatModels: Model[];
  embeddingModels: Model[];
};

export type { Model, ModelList, ProviderMetadata, MinimalProvider };
