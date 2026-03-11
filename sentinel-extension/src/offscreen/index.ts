/**
 * Offscreen document for running WebLLM inference.
 *
 * Chrome extension service workers don't have access to WebGPU,
 * so we run the LLM in this offscreen document and communicate
 * with the background worker via chrome.runtime messages.
 */

import { WEBLLM_MODEL_ID } from '../lib/constants';
import { SECURITY_ANALYST_SYSTEM_PROMPT } from '../lib/prompts';

// WebLLM is loaded from CDN at runtime (see offscreen.html)
// We use dynamic import so the bundle stays small and the
// actual engine is fetched only when needed.

let engine: any = null;
let isLoading = false;
let isReady = false;

async function initializeEngine(): Promise<void> {
  if (isLoading || isReady) return;
  isLoading = true;

  try {
    // Dynamic import of WebLLM from CDN
    const webllm = await import(
      /* webpackIgnore: true */
      'https://esm.run/@anthropic-ai/webllm'
    ).catch(() =>
      // Fallback CDN
      import(
        /* webpackIgnore: true */
        'https://cdn.jsdelivr.net/npm/@anthropic-ai/webllm@latest/+esm'
      ),
    ).catch(() =>
      // Community WebLLM package as final fallback
      import(
        /* webpackIgnore: true */
        'https://esm.run/@anthropic-ai/webllm'
      ),
    );

    const CreateMLCEngine = webllm.CreateMLCEngine ?? webllm.default?.CreateMLCEngine;

    if (!CreateMLCEngine) {
      throw new Error('Could not find CreateMLCEngine in WebLLM module');
    }

    engine = await CreateMLCEngine(WEBLLM_MODEL_ID, {
      initProgressCallback: (progress: { text: string; progress: number }) => {
        chrome.runtime.sendMessage({
          type: 'LLM_LOADING_PROGRESS',
          payload: {
            progress: progress.progress ?? 0,
            text: progress.text ?? 'Loading...',
          },
        }).catch(() => {});
      },
    });

    isReady = true;
    isLoading = false;

    chrome.runtime.sendMessage({
      type: 'LLM_READY',
      payload: { model: WEBLLM_MODEL_ID },
    }).catch(() => {});

    console.log('[Sentinel Offscreen] WebLLM engine ready');
  } catch (err) {
    isLoading = false;
    console.error('[Sentinel Offscreen] Failed to load WebLLM:', err);

    chrome.runtime.sendMessage({
      type: 'LLM_ERROR',
      payload: { error: String(err) },
    }).catch(() => {});
  }
}

async function runInference(
  prompt: string,
  requestId: string,
): Promise<void> {
  if (!engine || !isReady) {
    chrome.runtime.sendMessage({
      type: 'LLM_INFERENCE_RESULT',
      payload: { requestId, error: 'Engine not ready' },
    }).catch(() => {});
    return;
  }

  try {
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SECURITY_ANALYST_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 600,
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    chrome.runtime.sendMessage({
      type: 'LLM_INFERENCE_RESULT',
      payload: { requestId, content },
    }).catch(() => {});
  } catch (err) {
    chrome.runtime.sendMessage({
      type: 'LLM_INFERENCE_RESULT',
      payload: { requestId, error: String(err) },
    }).catch(() => {});
  }
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'LLM_INIT':
      initializeEngine();
      sendResponse({ success: true });
      break;

    case 'LLM_INFER':
      runInference(message.payload.prompt, message.payload.requestId);
      sendResponse({ success: true });
      break;

    case 'LLM_STATUS':
      sendResponse({ ready: isReady, loading: isLoading });
      break;

    default:
      // Ignore messages not meant for offscreen
      break;
  }
  return true;
});

// Auto-initialize on load
initializeEngine();
