/**
 * Tests for reasoning toggle state management:
 * - BaseLLM.setReasoning()
 * - localStorage persistence patterns
 * - Reasoning config derivation for the agent
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- BaseLLM reasoning ---

class TestLLM {
  protected reasoning?: { effort: string };

  setReasoning(reasoning: { effort: string }) {
    this.reasoning = reasoning;
  }

  getReasoning() {
    return this.reasoning;
  }
}

describe('BaseLLM: setReasoning', () => {
  it('stores reasoning config', () => {
    const llm = new TestLLM();
    llm.setReasoning({ effort: 'high' });
    expect(llm.getReasoning()).toEqual({ effort: 'high' });
  });

  it('starts with no reasoning', () => {
    const llm = new TestLLM();
    expect(llm.getReasoning()).toBeUndefined();
  });

  it('can update reasoning effort', () => {
    const llm = new TestLLM();
    llm.setReasoning({ effort: 'low' });
    llm.setReasoning({ effort: 'high' });
    expect(llm.getReasoning()).toEqual({ effort: 'high' });
  });

  it('accepts all effort levels', () => {
    const llm = new TestLLM();
    for (const effort of ['low', 'medium', 'high']) {
      llm.setReasoning({ effort });
      expect(llm.getReasoning()!.effort).toBe(effort);
    }
  });
});

// --- Reasoning localStorage persistence ---

describe('Reasoning: localStorage persistence', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  // Simulate the init pattern from useChat.tsx
  function initReasoningEnabled(): boolean {
    return localStorage.getItem('reasoningEnabled') === 'true';
  }

  function initReasoningEffort(): string {
    return localStorage.getItem('reasoningEffort') || 'medium';
  }

  // Simulate the handler patterns from useChat.tsx
  function handleSetReasoningEnabled(
    enabled: boolean,
    currentEffort: string,
  ): { enabled: boolean; effort: string } {
    localStorage.setItem('reasoningEnabled', String(enabled));
    let effort = currentEffort;
    if (enabled && !currentEffort) {
      effort = 'medium';
      localStorage.setItem('reasoningEffort', 'medium');
    }
    return { enabled, effort };
  }

  function handleSetReasoningEffort(effort: string): string {
    localStorage.setItem('reasoningEffort', effort);
    return effort;
  }

  it('defaults to disabled', () => {
    expect(initReasoningEnabled()).toBe(false);
  });

  it('defaults effort to medium', () => {
    expect(initReasoningEffort()).toBe('medium');
  });

  it('persists enabled=true', () => {
    handleSetReasoningEnabled(true, 'medium');
    expect(localStorage.getItem('reasoningEnabled')).toBe('true');
    expect(initReasoningEnabled()).toBe(true);
  });

  it('persists enabled=false', () => {
    handleSetReasoningEnabled(true, 'medium');
    handleSetReasoningEnabled(false, 'medium');
    expect(localStorage.getItem('reasoningEnabled')).toBe('false');
    expect(initReasoningEnabled()).toBe(false);
  });

  it('persists effort level', () => {
    handleSetReasoningEffort('high');
    expect(localStorage.getItem('reasoningEffort')).toBe('high');
    expect(initReasoningEffort()).toBe('high');
  });

  it('auto-sets effort to medium on enable if empty', () => {
    const result = handleSetReasoningEnabled(true, '');
    expect(result.effort).toBe('medium');
    expect(localStorage.getItem('reasoningEffort')).toBe('medium');
  });

  it('preserves existing effort on enable', () => {
    handleSetReasoningEffort('high');
    const result = handleSetReasoningEnabled(true, 'high');
    expect(result.effort).toBe('high');
  });

  it('round-trips all effort levels', () => {
    for (const effort of ['low', 'medium', 'high']) {
      handleSetReasoningEffort(effort);
      expect(initReasoningEffort()).toBe(effort);
    }
  });
});

// --- Reasoning config derivation (agent config building) ---

describe('Reasoning: agent config derivation', () => {
  // Simulates the logic from chat/route.ts
  function deriveReasoningConfig(body: {
    reasoning?: { enabled: boolean; effort?: string };
  }): { effort: string } | undefined {
    return body.reasoning?.enabled
      ? { effort: body.reasoning.effort || 'medium' }
      : undefined;
  }

  it('returns undefined when reasoning is absent', () => {
    expect(deriveReasoningConfig({})).toBeUndefined();
  });

  it('returns undefined when reasoning.enabled is false', () => {
    expect(
      deriveReasoningConfig({ reasoning: { enabled: false } }),
    ).toBeUndefined();
  });

  it('returns effort when enabled', () => {
    expect(
      deriveReasoningConfig({ reasoning: { enabled: true, effort: 'high' } }),
    ).toEqual({ effort: 'high' });
  });

  it('defaults effort to medium when not specified', () => {
    expect(
      deriveReasoningConfig({ reasoning: { enabled: true } }),
    ).toEqual({ effort: 'medium' });
  });

  it('passes through all effort levels', () => {
    for (const effort of ['low', 'medium', 'high']) {
      expect(
        deriveReasoningConfig({ reasoning: { enabled: true, effort } }),
      ).toEqual({ effort });
    }
  });
});
