// Type declarations for CDN-loaded WebLLM modules.
// These are loaded at runtime via dynamic import with webpackIgnore,
// so webpack does not bundle them.

declare module 'https://esm.run/@anthropic-ai/webllm' {
  export function CreateMLCEngine(
    model: string,
    options?: {
      initProgressCallback?: (progress: { text: string; progress: number }) => void;
    },
  ): Promise<any>;
}

declare module 'https://cdn.jsdelivr.net/npm/@anthropic-ai/webllm@latest/+esm' {
  export function CreateMLCEngine(
    model: string,
    options?: {
      initProgressCallback?: (progress: { text: string; progress: number }) => void;
    },
  ): Promise<any>;
}
