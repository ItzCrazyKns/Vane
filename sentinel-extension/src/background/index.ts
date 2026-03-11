import type {
  PageMetadata,
  ThreatAnalysisResult,
  ThreatLevel,
  ThreatType,
  EvidenceRecord,
  SentinelSettings,
} from '../lib/types';
import {
  detectHeuristicThreats,
  calculateThreatScore,
} from '../lib/heuristics';
import { generateReport } from '../lib/report';
import { buildAnalysisPrompt } from '../lib/prompts';
import {
  installLLMMessageHandler,
  initLLM,
  runLLMInference,
  isLLMReady,
  isLLMLoading,
  getLLMModelName,
  onLLMProgress,
  onLLMReady,
  onLLMError,
} from '../lib/llmBridge';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  MAX_EVIDENCE_RECORDS,
  SAFE_EXIT_URL,
  IGNORED_URL_PREFIXES,
  THREAT_THRESHOLDS,
} from '../lib/constants';

class SentinelBackground {
  private settings: SentinelSettings = { ...DEFAULT_SETTINGS };
  private recentlyAnalyzed = new Map<string, number>();
  private llmBusy = false;

  private static readonly DEDUP_TTL_MS = 60_000;
  private static readonly DEDUP_MAX_SIZE = 200;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();

    // Install the LLM message handler BEFORE the general handler
    // so it can intercept LLM-specific messages.
    installLLMMessageHandler();

    // Forward LLM lifecycle events to the sidepanel
    onLLMProgress((progress, text) => {
      chrome.runtime
        .sendMessage({
          type: 'MODEL_LOADING_PROGRESS',
          payload: { progress, text },
        })
        .catch(() => {});
    });

    onLLMReady((model) => {
      console.log('[Sentinel] LLM ready:', model);
    });

    onLLMError((error) => {
      console.error('[Sentinel] LLM error:', error);
    });

    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});

    // Start loading the LLM via offscreen document
    initLLM();
  }

  // ===== Combined Analysis (Heuristics + LLM) =====

  /**
   * Run heuristic analysis. Always available, fast.
   */
  private analyzeWithHeuristics(metadata: PageMetadata): ThreatAnalysisResult {
    const indicators = detectHeuristicThreats(metadata);
    const score = calculateThreatScore(indicators);
    const threshold = THREAT_THRESHOLDS[this.settings.sensitivityLevel];

    if (score < threshold) {
      return {
        isThreat: false,
        level: 'low',
        type: 'safe',
        confidence: 1 - score,
        summary: 'No significant threats detected',
        details: [],
      };
    }

    let level: ThreatLevel = 'low';
    if (score >= 0.8) level = 'critical';
    else if (score >= 0.6) level = 'high';
    else if (score >= 0.4) level = 'medium';

    let type: ThreatType = 'suspicious';
    const typeIndicators = indicators.map((i) => i.type);
    if (
      typeIndicators.includes('lookalike_domain') ||
      typeIndicators.includes('external_form_submission')
    ) {
      type = 'phishing';
    } else if (typeIndicators.includes('obfuscated_code')) {
      type = 'malware';
    } else if (typeIndicators.includes('urgency_tactic')) {
      type = 'scam';
    }

    return {
      isThreat: true,
      level,
      type,
      confidence: score,
      summary: `Detected ${indicators.length} threat indicator(s) on this page`,
      details: indicators.map((i) => i.description),
    };
  }

  /**
   * Run LLM analysis via the offscreen document.
   * Returns null if the LLM is not ready.
   */
  private async analyzeWithLLM(
    metadata: PageMetadata,
  ): Promise<ThreatAnalysisResult | null> {
    if (!isLLMReady() || this.llmBusy) return null;

    this.llmBusy = true;
    try {
      const prompt = buildAnalysisPrompt(metadata);
      const raw = await runLLMInference(prompt);

      // Extract JSON from the response (model may wrap it in markdown)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Sentinel] LLM returned non-JSON:', raw.slice(0, 200));
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (typeof parsed.isThreat !== 'boolean' || !parsed.level || !parsed.type) {
        console.warn('[Sentinel] LLM JSON missing fields:', parsed);
        return null;
      }

      return {
        isThreat: parsed.isThreat,
        level: parsed.level,
        type: parsed.type,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        summary: parsed.summary ?? 'LLM analysis complete',
        details: Array.isArray(parsed.details) ? parsed.details : [],
      };
    } catch (err) {
      console.error('[Sentinel] LLM analysis failed:', err);
      return null;
    } finally {
      this.llmBusy = false;
    }
  }

  /**
   * Merge heuristic and LLM results into a single verdict.
   *
   * Strategy:
   * - If only heuristics available, use heuristics.
   * - If both available, take the MORE severe verdict but boost
   *   confidence when both agree.
   * - LLM details are appended to heuristic details.
   */
  private mergeAnalysis(
    heuristic: ThreatAnalysisResult,
    llm: ThreatAnalysisResult | null,
  ): ThreatAnalysisResult {
    if (!llm) return heuristic;

    const levelSeverity: Record<ThreatLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };

    const hSev = levelSeverity[heuristic.level];
    const lSev = levelSeverity[llm.level];

    // Take the more severe result as the base
    const primary = lSev >= hSev ? llm : heuristic;
    const secondary = lSev >= hSev ? heuristic : llm;

    // If both flag as threat, boost confidence
    const bothThreat = heuristic.isThreat && llm.isThreat;
    const confidence = bothThreat
      ? Math.min(1, Math.max(primary.confidence, secondary.confidence) + 0.1)
      : primary.confidence;

    // Combine details, deduplicating
    const detailSet = new Set([...primary.details, ...secondary.details]);

    // If either says threat, it's a threat
    const isThreat = heuristic.isThreat || llm.isThreat;

    return {
      isThreat,
      level: primary.level,
      type: primary.type,
      confidence,
      summary: llm.summary || primary.summary,
      details: Array.from(detailSet),
    };
  }

  // ===== Screenshot =====

  private async captureScreenshot(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        null as unknown as number,
        { format: 'png', quality: 90 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        },
      );
    });
  }

  // ===== Evidence Storage =====

  private async saveEvidence(evidence: EvidenceRecord): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    const records: EvidenceRecord[] =
      data[STORAGE_KEYS.EVIDENCE_RECORDS] || [];

    records.push(evidence);

    while (records.length > MAX_EVIDENCE_RECORDS) {
      records.shift();
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.EVIDENCE_RECORDS]: records,
    });

    // Notify sidepanel
    chrome.runtime
      .sendMessage({ type: 'NEW_EVIDENCE', payload: evidence })
      .catch(() => {});
  }

  private async getEvidenceRecords(): Promise<EvidenceRecord[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    return (data[STORAGE_KEYS.EVIDENCE_RECORDS] || []).reverse();
  }

  private async deleteEvidenceRecord(id: string): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    const records: EvidenceRecord[] =
      data[STORAGE_KEYS.EVIDENCE_RECORDS] || [];
    const filtered = records.filter((r) => r.id !== id);
    await chrome.storage.local.set({
      [STORAGE_KEYS.EVIDENCE_RECORDS]: filtered,
    });
  }

  // ===== Threat Handling =====

  private async handleThreatDetected(
    tabId: number,
    metadata: PageMetadata,
    analysis: ThreatAnalysisResult,
  ): Promise<void> {
    // 1. Capture screenshot
    let screenshot = '';
    try {
      screenshot = await this.captureScreenshot();
    } catch (err) {
      console.error('[Sentinel] Screenshot failed:', err);
    }

    // 2. Get full DOM snapshot
    let domSnapshot = '';
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' });
      domSnapshot = resp?.dom || '';
    } catch (err) {
      console.error('[Sentinel] DOM capture failed:', err);
    }

    // 3. Build evidence record
    const evidence: EvidenceRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      url: metadata.url,
      domain: metadata.domain,
      screenshot,
      domSnapshot,
      metadata,
      threatAnalysis: analysis,
      exported: false,
    };

    // 4. Persist
    await this.saveEvidence(evidence);

    // 5. Show warning overlay
    chrome.tabs
      .sendMessage(tabId, {
        type: 'SHOW_WARNING',
        payload: {
          level: analysis.level,
          type: analysis.type,
          confidence: analysis.confidence,
          summary: analysis.summary,
        },
      })
      .catch(() => {});

    // 6. Auto-exit for high/critical threats if enabled
    if (
      this.settings.autoExit &&
      (analysis.level === 'high' || analysis.level === 'critical')
    ) {
      chrome.tabs.update(tabId, { url: SAFE_EXIT_URL });
    }
  }

  // ===== Page Analysis Entry Point =====

  private evictStaleDedup(): void {
    if (this.recentlyAnalyzed.size <= SentinelBackground.DEDUP_MAX_SIZE) return;
    const now = Date.now();
    for (const [key, ts] of this.recentlyAnalyzed) {
      if (now - ts > SentinelBackground.DEDUP_TTL_MS) {
        this.recentlyAnalyzed.delete(key);
      }
    }
  }

  private async analyzePage(
    metadata: PageMetadata,
    tabId: number,
    manual = false,
  ): Promise<void> {
    // Dedup: skip if same URL was analyzed recently (unless manual)
    if (!manual) {
      const lastAnalyzed = this.recentlyAnalyzed.get(metadata.url);
      if (lastAnalyzed && Date.now() - lastAnalyzed < SentinelBackground.DEDUP_TTL_MS) {
        return;
      }
    }
    this.recentlyAnalyzed.set(metadata.url, Date.now());
    this.evictStaleDedup();

    // Notify sidepanel that analysis is in progress
    chrome.runtime
      .sendMessage({
        type: 'ANALYSIS_STATUS',
        payload: { analyzing: true, url: metadata.url },
      })
      .catch(() => {});

    try {
      // 1. Always run heuristics (fast, no dependencies)
      const heuristicResult = this.analyzeWithHeuristics(metadata);

      // 2. Run LLM analysis if available
      const llmResult = await this.analyzeWithLLM(metadata);

      // 3. Merge results
      const merged = this.mergeAnalysis(heuristicResult, llmResult);

      if (merged.isThreat) {
        await this.handleThreatDetected(tabId, metadata, merged);
      }
    } catch (err) {
      console.error('[Sentinel] Analysis error:', err);
    } finally {
      chrome.runtime
        .sendMessage({
          type: 'ANALYSIS_STATUS',
          payload: { analyzing: false },
        })
        .catch(() => {});
    }
  }

  // ===== Settings =====

  private async loadSettings(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    if (data[STORAGE_KEYS.SETTINGS]) {
      this.settings = data[STORAGE_KEYS.SETTINGS];
    }
  }

  private async saveSettings(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: this.settings,
    });
  }

  // ===== Message Router =====

  private handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ): boolean {
    const tabId = sender.tab?.id;

    switch (message.type) {
      // --- Content script messages ---
      case 'PAGE_LOADED': {
        if (this.settings.autoAnalysis && tabId) {
          const url: string = message.payload?.url || '';
          if (!IGNORED_URL_PREFIXES.some((p) => url.startsWith(p))) {
            this.analyzePage(message.payload, tabId);
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'MANUAL_ANALYSIS': {
        if (tabId) {
          this.analyzePage(message.payload, tabId, true);
        }
        sendResponse({ success: true });
        break;
      }

      case 'EXIT_SITE': {
        if (tabId) {
          chrome.tabs.update(tabId, { url: SAFE_EXIT_URL });
        }
        sendResponse({ success: true });
        break;
      }

      // --- Sidepanel messages ---
      case 'GET_EVIDENCE_LIST': {
        this.getEvidenceRecords().then((records) => {
          sendResponse({ records });
        }).catch(() => {
          sendResponse({ records: [], error: 'Failed to load evidence' });
        });
        return true; // async
      }

      case 'DELETE_EVIDENCE': {
        this.deleteEvidenceRecord(message.payload.id).then(() => {
          sendResponse({ success: true });
        }).catch(() => {
          sendResponse({ success: false, error: 'Failed to delete' });
        });
        return true;
      }

      case 'GET_SETTINGS': {
        sendResponse({ settings: this.settings });
        break;
      }

      case 'UPDATE_SETTINGS': {
        this.settings = { ...this.settings, ...message.payload };
        this.saveSettings();
        sendResponse({ success: true });
        break;
      }

      case 'EXPORT_REPORT': {
        this.getEvidenceRecords().then((records) => {
          const record = records.find(
            (r) => r.id === message.payload.id,
          );
          if (record) {
            sendResponse({
              report: JSON.stringify(generateReport(record), null, 2),
            });
          } else {
            sendResponse({ error: 'Record not found' });
          }
        }).catch(() => {
          sendResponse({ error: 'Failed to generate report' });
        });
        return true;
      }

      case 'GET_MODEL_STATUS': {
        sendResponse({
          loaded: isLLMReady(),
          loading: isLLMLoading(),
          model: getLLMModelName() || 'gemma-3n',
          loadingProgress: 0,
        });
        break;
      }

      case 'TRIGGER_MANUAL_ANALYSIS': {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { type: 'ANALYZE_NOW' });
          }
        });
        sendResponse({ success: true });
        break;
      }

      // --- LLM messages handled by llmBridge, ignore here ---
      case 'LLM_LOADING_PROGRESS':
      case 'LLM_READY':
      case 'LLM_ERROR':
      case 'LLM_INFERENCE_RESULT':
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  }
}

new SentinelBackground();
