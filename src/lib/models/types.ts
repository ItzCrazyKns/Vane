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

export type { Model, ModelList, ProviderMetadata };
