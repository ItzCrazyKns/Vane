/**
 * Bridge between the background service worker and the offscreen
 * document that runs WebLLM.
 *
 * The background worker cannot use WebGPU directly, so all LLM
 * inference is delegated to the offscreen document via messages.
 */

const OFFSCREEN_URL = 'offscreen.html';

// Pending inference callbacks keyed by requestId
const pendingRequests = new Map<
  string,
  { resolve: (value: string) => void; reject: (reason: string) => void }
>();

let offscreenCreated = false;
let modelReady = false;
let modelLoading = false;
let modelName = '';

// Callbacks for status updates
let onProgressCallback: ((progress: number, text: string) => void) | null = null;
let onReadyCallback: ((model: string) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;

/**
 * Ensure the offscreen document exists.
 */
async function ensureOffscreen(): Promise<void> {
  if (offscreenCreated) return;

  // Check if one already exists
  const existingContexts = await (chrome.runtime as any).getContexts?.({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  }) ?? [];

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  try {
    await (chrome.offscreen as any).createDocument({
      url: OFFSCREEN_URL,
      reasons: ['LOCAL_STORAGE'], // closest valid reason for ML workloads
      justification: 'Running local LLM inference via WebLLM for threat analysis',
    });
    offscreenCreated = true;
  } catch (err: any) {
    // If already exists, that's fine
    if (err?.message?.includes('Only a single offscreen')) {
      offscreenCreated = true;
    } else {
      throw err;
    }
  }
}

/**
 * Install the message listener that receives results from offscreen.
 * Must be called once from the background worker's init.
 */
export function installLLMMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'LLM_LOADING_PROGRESS': {
        modelLoading = true;
        onProgressCallback?.(
          message.payload.progress,
          message.payload.text,
        );
        break;
      }

      case 'LLM_READY': {
        modelReady = true;
        modelLoading = false;
        modelName = message.payload.model;
        onReadyCallback?.(message.payload.model);
        break;
      }

      case 'LLM_ERROR': {
        modelLoading = false;
        onErrorCallback?.(message.payload.error);
        break;
      }

      case 'LLM_INFERENCE_RESULT': {
        const { requestId, content, error } = message.payload;
        const pending = pendingRequests.get(requestId);
        if (pending) {
          pendingRequests.delete(requestId);
          if (error) {
            pending.reject(error);
          } else {
            pending.resolve(content);
          }
        }
        break;
      }
    }
    // Don't return true here — we don't send a response for these
  });
}

/**
 * Register callbacks for model lifecycle events.
 */
export function onLLMProgress(
  cb: (progress: number, text: string) => void,
): void {
  onProgressCallback = cb;
}

export function onLLMReady(cb: (model: string) => void): void {
  onReadyCallback = cb;
}

export function onLLMError(cb: (error: string) => void): void {
  onErrorCallback = cb;
}

/**
 * Initialize the LLM by creating the offscreen document
 * and sending the init message.
 */
export async function initLLM(): Promise<void> {
  try {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: 'LLM_INIT' }).catch(() => {});
  } catch (err) {
    console.error('[Sentinel] Failed to init LLM offscreen:', err);
  }
}

/**
 * Run inference and return the model's text output.
 * Rejects if the engine is not ready or inference fails.
 */
export function runLLMInference(prompt: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!offscreenCreated) {
      try {
        await ensureOffscreen();
      } catch {
        reject('Offscreen document not available');
        return;
      }
    }

    const requestId = crypto.randomUUID();
    pendingRequests.set(requestId, { resolve, reject });

    // Timeout after 60s
    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject('LLM inference timed out');
      }
    }, 60_000);

    // Clear timeout on completion
    const originalResolve = resolve;
    const originalReject = reject;
    pendingRequests.set(requestId, {
      resolve: (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      },
      reject: (reason) => {
        clearTimeout(timeout);
        originalReject(reason);
      },
    });

    chrome.runtime
      .sendMessage({
        type: 'LLM_INFER',
        payload: { prompt, requestId },
      })
      .catch(() => {
        pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject('Failed to send inference request');
      });
  });
}

/**
 * Check if the model is ready for inference.
 */
export function isLLMReady(): boolean {
  return modelReady;
}

/**
 * Check if the model is currently loading.
 */
export function isLLMLoading(): boolean {
  return modelLoading;
}

/**
 * Get the current model name.
 */
export function getLLMModelName(): string {
  return modelName;
}
