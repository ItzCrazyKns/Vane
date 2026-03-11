# Sentinel Mode - Implementation Plan

> A privacy-first threat detection and evidence gathering mode for Perplexica, implemented as a Chrome extension.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Chrome Extension Structure](#chrome-extension-structure)
4. [Component Specifications](#component-specifications)
5. [WebLLM + Gemma 3n Integration](#webllm--gemma-3n-integration)
6. [Threat Detection System](#threat-detection-system)
7. [Warning Overlay System](#warning-overlay-system)
8. [Evidence Collection & Storage](#evidence-collection--storage)
9. [JSON Report Format](#json-report-format)
10. [Perplexica Backend Integration](#perplexica-backend-integration)
11. [Implementation Phases](#implementation-phases)
12. [File Structure](#file-structure)

---

## Overview

### Product Vision

Sentinel Mode transforms Perplexica into a security-focused browsing companion that:
- **Monitors** web pages in real-time using a local AI (Gemma 3n via WebLLM)
- **Detects** phishing, scam, and malware threats through DOM and visual analysis
- **Warns** users with visual overlays before they interact with malicious content
- **Collects** forensic evidence (screenshots, DOM, network logs) for reporting
- **Protects** users by offering immediate exit from dangerous sites

### Target Users

- Elderly users vulnerable to phishing and scams
- Security-conscious individuals
- Family members helping protect relatives online
- Anyone who wants documented evidence of cyber threats

### MVP Features (Essential)

| Feature | Description |
|---------|-------------|
| Screenshot capture | Capture visible tab when threat detected |
| DOM structure analysis | Extract and analyze page structure |
| JSON report output | Structured evidence documentation |
| Visual warning overlay | Prominent alert on malicious pages |
| Local evidence storage | IndexedDB for persistence |
| Auto + Manual trigger | Both automatic detection and manual analysis |
| Exit site functionality | Navigate user away from threats |

### Nice-to-Have Features (Post-MVP)

| Feature | Description |
|---------|-------------|
| Gemini 2.5 deep analysis | Cloud-based vision analysis for complex threats |
| VirusTotal integration | File/URL reputation checking |
| Human-readable reports | Formatted reports for law enforcement |
| Threat pattern updates | Downloadable threat signature updates |

---

## Architecture

### Two-Tiered AI System

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TIER 1: LOCAL GUARDIAN                            │
│                    (Always Active, Privacy-First)                    │
│                                                                      │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│    │   WebLLM    │    │  Gemma 3n   │    │  Threat Heuristics  │   │
│    │   Runtime   │───▶│   Model     │───▶│  (Pattern Matching) │   │
│    └─────────────┘    └─────────────┘    └──────────┬──────────┘   │
│                                                      │              │
│                                          Threat Score > Threshold?  │
│                                                      │              │
│                              ┌───────────────────────┴────────┐     │
│                              │                                │     │
│                              ▼                                ▼     │
│                         [SAFE]                          [THREAT]    │
│                      Continue browsing              Trigger Tier 2  │
└─────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TIER 2: INVESTIGATION MODE                        │
│                    (Triggered on Threat Detection)                   │
│                                                                      │
│    1. Capture screenshot ──────────────────────────────────────┐    │
│    2. Extract full DOM ────────────────────────────────────────┤    │
│    3. Record network logs ─────────────────────────────────────┤    │
│    4. Display warning overlay ─────────────────────────────────┤    │
│    5. Generate JSON report ────────────────────────────────────┤    │
│    6. Save to IndexedDB ───────────────────────────────────────┤    │
│    7. Offer EXIT button ───────────────────────────────────────┘    │
│                                                                      │
│    [Optional: Send to Perplexica backend for Gemini analysis]       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Content    │◀───────▶│    Background    │◀───────▶│   Sidepanel  │
│   Script     │ chrome  │  Service Worker  │ chrome  │   (React)    │
│              │ runtime │                  │ runtime │              │
│ • DOM access │ message │ • WebLLM engine  │ message │ • UI display │
│ • Overlays   │         │ • Screenshot     │         │ • Reports    │
│ • Metadata   │         │ • Storage        │         │ • Settings   │
└──────────────┘         └──────────────────┘         └──────────────┘
       │                          │                          │
       │                          ▼                          │
       │                 ┌──────────────────┐                │
       │                 │    IndexedDB     │                │
       │                 │  (Local Storage) │                │
       │                 └──────────────────┘                │
       │                          │                          │
       └──────────────────────────┴──────────────────────────┘
                                  │
                                  ▼ (Optional, Nice-to-Have)
                    ┌──────────────────────────┐
                    │   Perplexica Backend     │
                    │  • Gemini 2.5 Analysis   │
                    │  • VirusTotal API        │
                    │  • Report Generation     │
                    └──────────────────────────┘
```

---

## Chrome Extension Structure

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Perplexica Sentinel Mode",
  "version": "1.0.0",
  "description": "Privacy-first threat detection and evidence gathering",

  "permissions": [
    "activeTab",
    "tabs",
    "scripting",
    "storage",
    "sidePanel",
    "webNavigation"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["sentinel-overlay.css"],
      "run_at": "document_idle"
    }
  ],

  "side_panel": {
    "default_path": "sidepanel.html"
  },

  "action": {
    "default_icon": {
      "16": "icons/sentinel-16.png",
      "48": "icons/sentinel-48.png",
      "128": "icons/sentinel-128.png"
    },
    "default_title": "Sentinel Mode"
  },

  "icons": {
    "16": "icons/sentinel-16.png",
    "48": "icons/sentinel-48.png",
    "128": "icons/sentinel-128.png"
  },

  "web_accessible_resources": [
    {
      "resources": ["models/*", "assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## Component Specifications

### 1. Content Script (`content.ts`)

**Purpose:** Runs on every webpage to monitor DOM, extract metadata, and display warning overlays.

```typescript
// content.ts - Core Structure

interface PageMetadata {
  url: string;
  title: string;
  domain: string;
  timestamp: number;
  domStructure: DOMStructure;
  forms: FormInfo[];
  externalLinks: LinkInfo[];
  scripts: ScriptInfo[];
  iframes: IframeInfo[];
}

interface DOMStructure {
  totalElements: number;
  formCount: number;
  inputFields: InputFieldInfo[];
  suspiciousPatterns: string[];
}

// Main content script logic
class SentinelContentScript {
  private isAnalyzing: boolean = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Listen for messages from background
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Extract initial page metadata
    const metadata = await this.extractPageMetadata();

    // Send to background for analysis
    chrome.runtime.sendMessage({
      type: 'PAGE_LOADED',
      payload: metadata
    });
  }

  private async extractPageMetadata(): Promise<PageMetadata> {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      timestamp: Date.now(),
      domStructure: this.analyzeDOMStructure(),
      forms: this.extractForms(),
      externalLinks: this.extractExternalLinks(),
      scripts: this.extractScripts(),
      iframes: this.extractIframes()
    };
  }

  private analyzeDOMStructure(): DOMStructure {
    const inputs = document.querySelectorAll('input');
    const inputFields: InputFieldInfo[] = [];

    inputs.forEach(input => {
      inputFields.push({
        type: input.type,
        name: input.name,
        placeholder: input.placeholder,
        isPassword: input.type === 'password',
        isHidden: input.type === 'hidden' ||
                  window.getComputedStyle(input).display === 'none'
      });
    });

    return {
      totalElements: document.querySelectorAll('*').length,
      formCount: document.forms.length,
      inputFields,
      suspiciousPatterns: this.detectSuspiciousPatterns()
    };
  }

  private detectSuspiciousPatterns(): string[] {
    const patterns: string[] = [];
    const bodyText = document.body?.innerText?.toLowerCase() || '';

    // Urgency patterns
    const urgencyTerms = [
      'act now', 'urgent', 'immediate action', 'account suspended',
      'verify immediately', 'expires today', 'last warning'
    ];
    urgencyTerms.forEach(term => {
      if (bodyText.includes(term)) {
        patterns.push(`URGENCY: "${term}"`);
      }
    });

    // Financial patterns
    const financialTerms = [
      'bank account', 'credit card', 'ssn', 'social security',
      'wire transfer', 'bitcoin', 'gift card'
    ];
    financialTerms.forEach(term => {
      if (bodyText.includes(term)) {
        patterns.push(`FINANCIAL: "${term}"`);
      }
    });

    // Check for password fields on non-HTTPS
    if (window.location.protocol !== 'https:' &&
        document.querySelector('input[type="password"]')) {
      patterns.push('SECURITY: Password field on non-HTTPS page');
    }

    return patterns;
  }

  private extractForms(): FormInfo[] {
    const forms: FormInfo[] = [];
    document.querySelectorAll('form').forEach(form => {
      forms.push({
        action: form.action,
        method: form.method,
        hasPasswordField: !!form.querySelector('input[type="password"]'),
        inputCount: form.querySelectorAll('input').length,
        isExternal: !form.action.includes(window.location.hostname)
      });
    });
    return forms;
  }

  private extractExternalLinks(): LinkInfo[] {
    const links: LinkInfo[] = [];
    document.querySelectorAll('a[href]').forEach(anchor => {
      const a = anchor as HTMLAnchorElement;
      if (a.hostname !== window.location.hostname) {
        links.push({
          href: a.href,
          text: a.innerText.substring(0, 100),
          isHidden: window.getComputedStyle(a).display === 'none'
        });
      }
    });
    return links;
  }

  private extractScripts(): ScriptInfo[] {
    const scripts: ScriptInfo[] = [];
    document.querySelectorAll('script').forEach(script => {
      scripts.push({
        src: script.src || '[inline]',
        isExternal: !!script.src && !script.src.includes(window.location.hostname),
        hasObfuscation: this.detectObfuscation(script.textContent || '')
      });
    });
    return scripts;
  }

  private detectObfuscation(code: string): boolean {
    // Simple heuristics for obfuscated code
    const suspiciousPatterns = [
      /eval\s*\(/,
      /document\.write/,
      /unescape\s*\(/,
      /fromCharCode/,
      /\\x[0-9a-f]{2}/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(code));
  }

  private extractIframes(): IframeInfo[] {
    const iframes: IframeInfo[] = [];
    document.querySelectorAll('iframe').forEach(iframe => {
      iframes.push({
        src: iframe.src,
        isHidden: iframe.width === '0' || iframe.height === '0' ||
                  window.getComputedStyle(iframe).display === 'none',
        isExternal: !!iframe.src && !iframe.src.includes(window.location.hostname)
      });
    });
    return iframes;
  }

  // Display warning overlay
  public showWarningOverlay(threat: ThreatInfo): void {
    const overlay = document.createElement('div');
    overlay.id = 'sentinel-warning-overlay';
    overlay.innerHTML = `
      <div class="sentinel-warning-container">
        <div class="sentinel-warning-icon">⚠️</div>
        <h1 class="sentinel-warning-title">Potential Threat Detected</h1>
        <p class="sentinel-warning-message">${threat.summary}</p>
        <div class="sentinel-warning-details">
          <strong>Threat Level:</strong> ${threat.level}<br>
          <strong>Type:</strong> ${threat.type}<br>
          <strong>Confidence:</strong> ${(threat.confidence * 100).toFixed(0)}%
        </div>
        <div class="sentinel-warning-actions">
          <button id="sentinel-exit-btn" class="sentinel-btn-exit">
            🚪 Exit This Site
          </button>
          <button id="sentinel-continue-btn" class="sentinel-btn-continue">
            Continue Anyway (Not Recommended)
          </button>
        </div>
        <p class="sentinel-warning-footer">
          Evidence has been saved. Click the Sentinel icon to view the report.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('sentinel-exit-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'EXIT_SITE' });
    });

    document.getElementById('sentinel-continue-btn')?.addEventListener('click', () => {
      overlay.remove();
    });
  }

  private handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): boolean {
    switch (message.type) {
      case 'SHOW_WARNING':
        this.showWarningOverlay(message.payload);
        sendResponse({ success: true });
        break;

      case 'GET_DOM':
        sendResponse({ dom: document.documentElement.outerHTML });
        break;

      case 'ANALYZE_NOW':
        this.extractPageMetadata().then(metadata => {
          chrome.runtime.sendMessage({
            type: 'MANUAL_ANALYSIS',
            payload: metadata
          });
        });
        sendResponse({ success: true });
        break;
    }
    return true; // Keep channel open for async response
  }
}

// Initialize
new SentinelContentScript();
```

### 2. Background Service Worker (`background.ts`)

**Purpose:** Runs WebLLM with Gemma 3n, captures screenshots, manages storage, and coordinates all components.

```typescript
// background.ts - Core Structure

import { CreateMLCEngine, MLCEngine } from '@anthropic-ai/webllm';

interface ThreatAnalysisResult {
  isThreat: boolean;
  level: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  confidence: number;
  summary: string;
  details: string[];
}

interface EvidenceRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  screenshot: string; // base64
  domSnapshot: string;
  metadata: PageMetadata;
  threatAnalysis: ThreatAnalysisResult;
  networkLogs: NetworkLog[];
}

class SentinelBackground {
  private engine: MLCEngine | null = null;
  private isModelLoaded: boolean = false;
  private analysisQueue: PageMetadata[] = [];
  private settings: SentinelSettings = {
    autoAnalysis: true,
    sensitivityLevel: 'medium',
    autoExit: false,
    collectNetworkLogs: true
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Load settings
    await this.loadSettings();

    // Initialize WebLLM
    await this.initializeWebLLM();

    // Set up message listeners
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Set up web navigation listener
    chrome.webNavigation.onCompleted.addListener(this.onPageLoad.bind(this));

    // Set up side panel
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  private async initializeWebLLM(): Promise<void> {
    try {
      console.log('[Sentinel] Initializing WebLLM with Gemma 3n...');

      this.engine = await CreateMLCEngine('gemma-3n-E2B-it-q4f16_1-MLC', {
        initProgressCallback: (progress) => {
          console.log(`[Sentinel] Model loading: ${progress.text}`);
          // Notify sidepanel of loading progress
          this.broadcastToSidepanel({
            type: 'MODEL_LOADING_PROGRESS',
            payload: progress
          });
        }
      });

      this.isModelLoaded = true;
      console.log('[Sentinel] WebLLM initialized successfully');

      // Process any queued analyses
      this.processQueue();

    } catch (error) {
      console.error('[Sentinel] Failed to initialize WebLLM:', error);
    }
  }

  private async analyzeWithLocalLLM(metadata: PageMetadata): Promise<ThreatAnalysisResult> {
    if (!this.engine || !this.isModelLoaded) {
      throw new Error('WebLLM not initialized');
    }

    const prompt = this.buildAnalysisPrompt(metadata);

    const response = await this.engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a security analyst AI. Analyze web pages for phishing, scams, and malware indicators.

Respond in JSON format:
{
  "isThreat": boolean,
  "level": "low" | "medium" | "high" | "critical",
  "type": "phishing" | "scam" | "malware" | "suspicious" | "safe",
  "confidence": number (0-1),
  "summary": "Brief explanation",
  "details": ["Specific indicator 1", "Specific indicator 2"]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '';

    try {
      return JSON.parse(content);
    } catch {
      // Fallback if JSON parsing fails
      return {
        isThreat: false,
        level: 'low',
        type: 'unknown',
        confidence: 0,
        summary: 'Analysis inconclusive',
        details: []
      };
    }
  }

  private buildAnalysisPrompt(metadata: PageMetadata): string {
    return `Analyze this webpage for security threats:

URL: ${metadata.url}
Title: ${metadata.title}
Domain: ${metadata.domain}

DOM Analysis:
- Total elements: ${metadata.domStructure.totalElements}
- Forms: ${metadata.domStructure.formCount}
- Password fields: ${metadata.domStructure.inputFields.filter(f => f.isPassword).length}
- Hidden inputs: ${metadata.domStructure.inputFields.filter(f => f.isHidden).length}

Suspicious Patterns Found:
${metadata.domStructure.suspiciousPatterns.map(p => `- ${p}`).join('\n') || 'None'}

Forms Analysis:
${metadata.forms.map(f => `- Action: ${f.action}, External: ${f.isExternal}, Has Password: ${f.hasPasswordField}`).join('\n') || 'No forms'}

External Links: ${metadata.externalLinks.length}
Iframes: ${metadata.iframes.length} (Hidden: ${metadata.iframes.filter(i => i.isHidden).length})
Scripts with obfuscation: ${metadata.scripts.filter(s => s.hasObfuscation).length}

Is this page safe or a potential threat? Analyze carefully.`;
  }

  private async captureScreenshot(tabId: number): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        undefined,
        { format: 'png', quality: 90 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        }
      );
    });
  }

  private async saveEvidence(evidence: EvidenceRecord): Promise<void> {
    // Get existing records
    const { evidenceRecords = [] } = await chrome.storage.local.get('evidenceRecords');

    // Add new record
    evidenceRecords.push(evidence);

    // Keep only last 100 records to manage storage
    if (evidenceRecords.length > 100) {
      evidenceRecords.shift();
    }

    await chrome.storage.local.set({ evidenceRecords });

    // Notify sidepanel
    this.broadcastToSidepanel({
      type: 'NEW_EVIDENCE',
      payload: evidence
    });
  }

  private generateJSONReport(evidence: EvidenceRecord): string {
    return JSON.stringify({
      reportVersion: '1.0',
      generatedAt: new Date().toISOString(),
      threat: {
        url: evidence.url,
        domain: evidence.domain,
        detectedAt: new Date(evidence.timestamp).toISOString(),
        analysis: evidence.threatAnalysis
      },
      evidence: {
        screenshotIncluded: !!evidence.screenshot,
        domSnapshotIncluded: !!evidence.domSnapshot,
        networkLogsCount: evidence.networkLogs?.length || 0
      },
      pageMetadata: {
        title: evidence.metadata.title,
        formsCount: evidence.metadata.forms.length,
        externalLinksCount: evidence.metadata.externalLinks.length,
        suspiciousPatterns: evidence.metadata.domStructure.suspiciousPatterns
      }
    }, null, 2);
  }

  private async handleThreatDetected(
    tabId: number,
    metadata: PageMetadata,
    analysis: ThreatAnalysisResult
  ): Promise<void> {
    console.log('[Sentinel] Threat detected:', analysis);

    // 1. Capture screenshot
    let screenshot = '';
    try {
      screenshot = await this.captureScreenshot(tabId);
    } catch (error) {
      console.error('[Sentinel] Failed to capture screenshot:', error);
    }

    // 2. Get full DOM
    let domSnapshot = '';
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' });
      domSnapshot = response.dom;
    } catch (error) {
      console.error('[Sentinel] Failed to get DOM:', error);
    }

    // 3. Create evidence record
    const evidence: EvidenceRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      url: metadata.url,
      domain: metadata.domain,
      screenshot,
      domSnapshot,
      metadata,
      threatAnalysis: analysis,
      networkLogs: [] // TODO: Implement network log collection
    };

    // 4. Save evidence
    await this.saveEvidence(evidence);

    // 5. Show warning overlay
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_WARNING',
      payload: {
        level: analysis.level,
        type: analysis.type,
        confidence: analysis.confidence,
        summary: analysis.summary
      }
    });

    // 6. Auto-exit if enabled and threat is high/critical
    if (this.settings.autoExit &&
        (analysis.level === 'high' || analysis.level === 'critical')) {
      this.exitSite(tabId);
    }
  }

  private async exitSite(tabId: number): Promise<void> {
    // Navigate to a safe page
    chrome.tabs.update(tabId, { url: 'chrome://newtab' });
  }

  private async onPageLoad(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): Promise<void> {
    // Only process main frame
    if (details.frameId !== 0) return;

    // Skip chrome:// and extension pages
    if (details.url.startsWith('chrome://') ||
        details.url.startsWith('chrome-extension://')) {
      return;
    }

    console.log('[Sentinel] Page loaded:', details.url);
  }

  private handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): boolean {
    const tabId = sender.tab?.id;

    switch (message.type) {
      case 'PAGE_LOADED':
        if (this.settings.autoAnalysis && tabId) {
          this.queueAnalysis(message.payload, tabId);
        }
        sendResponse({ success: true });
        break;

      case 'MANUAL_ANALYSIS':
        if (tabId) {
          this.queueAnalysis(message.payload, tabId);
        }
        sendResponse({ success: true });
        break;

      case 'EXIT_SITE':
        if (tabId) {
          this.exitSite(tabId);
        }
        sendResponse({ success: true });
        break;

      case 'GET_EVIDENCE_LIST':
        chrome.storage.local.get('evidenceRecords').then(({ evidenceRecords = [] }) => {
          sendResponse({ records: evidenceRecords });
        });
        return true; // Keep channel open for async

      case 'GET_SETTINGS':
        sendResponse({ settings: this.settings });
        break;

      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.payload };
        this.saveSettings();
        sendResponse({ success: true });
        break;

      case 'EXPORT_REPORT':
        chrome.storage.local.get('evidenceRecords').then(({ evidenceRecords = [] }) => {
          const record = evidenceRecords.find((r: EvidenceRecord) => r.id === message.payload.id);
          if (record) {
            const report = this.generateJSONReport(record);
            sendResponse({ report });
          } else {
            sendResponse({ error: 'Record not found' });
          }
        });
        return true;

      case 'GET_MODEL_STATUS':
        sendResponse({
          loaded: this.isModelLoaded,
          model: 'gemma-3n'
        });
        break;
    }

    return true;
  }

  private async queueAnalysis(metadata: PageMetadata, tabId: number): Promise<void> {
    if (!this.isModelLoaded) {
      this.analysisQueue.push(metadata);
      console.log('[Sentinel] Model not ready, queued analysis');
      return;
    }

    try {
      const analysis = await this.analyzeWithLocalLLM(metadata);

      if (analysis.isThreat && analysis.confidence > 0.5) {
        await this.handleThreatDetected(tabId, metadata, analysis);
      } else {
        console.log('[Sentinel] Page appears safe:', metadata.url);
      }
    } catch (error) {
      console.error('[Sentinel] Analysis failed:', error);
    }
  }

  private async processQueue(): Promise<void> {
    while (this.analysisQueue.length > 0) {
      const metadata = this.analysisQueue.shift();
      if (metadata) {
        // Note: We'd need to track tabId with queued items in real implementation
        console.log('[Sentinel] Processing queued analysis for:', metadata.url);
      }
    }
  }

  private async loadSettings(): Promise<void> {
    const { sentinelSettings } = await chrome.storage.local.get('sentinelSettings');
    if (sentinelSettings) {
      this.settings = sentinelSettings;
    }
  }

  private async saveSettings(): Promise<void> {
    await chrome.storage.local.set({ sentinelSettings: this.settings });
  }

  private broadcastToSidepanel(message: any): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // Sidepanel might not be open, ignore
    });
  }
}

// Initialize
new SentinelBackground();
```

### 3. Sidepanel (`sidepanel/`)

**Purpose:** React-based UI for viewing threats, reports, and settings.

```typescript
// sidepanel/App.tsx

import React, { useState, useEffect } from 'react';

interface EvidenceRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  screenshot: string;
  threatAnalysis: ThreatAnalysisResult;
}

interface ThreatAnalysisResult {
  isThreat: boolean;
  level: string;
  type: string;
  confidence: number;
  summary: string;
  details: string[];
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'threats' | 'settings'>('threats');
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; model: string }>({
    loaded: false,
    model: ''
  });
  const [settings, setSettings] = useState({
    autoAnalysis: true,
    sensitivityLevel: 'medium',
    autoExit: false
  });

  useEffect(() => {
    // Load initial data
    loadEvidenceRecords();
    loadModelStatus();
    loadSettings();

    // Listen for new evidence
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_EVIDENCE') {
        setEvidenceRecords(prev => [message.payload, ...prev]);
      }
      if (message.type === 'MODEL_LOADING_PROGRESS') {
        // Could show loading progress
      }
    });
  }, []);

  const loadEvidenceRecords = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_EVIDENCE_LIST' });
    setEvidenceRecords(response.records || []);
  };

  const loadModelStatus = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' });
    setModelStatus(response);
  };

  const loadSettings = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(response.settings);
  };

  const updateSettings = async (newSettings: Partial<typeof settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: newSettings
    });
  };

  const exportReport = async (id: string) => {
    const response = await chrome.runtime.sendMessage({
      type: 'EXPORT_REPORT',
      payload: { id }
    });

    if (response.report) {
      const blob = new Blob([response.report], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-report-${id}.json`;
      a.click();
    }
  };

  const analyzeCurrentPage = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_NOW' });
    }
  };

  const getThreatLevelColor = (level: string): string => {
    switch (level) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  return (
    <div className="sentinel-sidepanel">
      {/* Header */}
      <header className="sentinel-header">
        <h1>🛡️ Sentinel Mode</h1>
        <div className="model-status">
          {modelStatus.loaded ? (
            <span className="status-online">● {modelStatus.model} ready</span>
          ) : (
            <span className="status-loading">⏳ Loading model...</span>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="sentinel-tabs">
        <button
          className={activeTab === 'threats' ? 'active' : ''}
          onClick={() => setActiveTab('threats')}
        >
          Threats ({evidenceRecords.length})
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      {/* Main Content */}
      <main className="sentinel-content">
        {activeTab === 'threats' && (
          <div className="threats-panel">
            {/* Manual Analyze Button */}
            <button
              className="analyze-btn"
              onClick={analyzeCurrentPage}
              disabled={!modelStatus.loaded}
            >
              🔍 Analyze Current Page
            </button>

            {/* Threats List */}
            {evidenceRecords.length === 0 ? (
              <div className="empty-state">
                <p>No threats detected yet.</p>
                <p>Sentinel is monitoring your browsing.</p>
              </div>
            ) : (
              <ul className="threats-list">
                {evidenceRecords.map(record => (
                  <li
                    key={record.id}
                    className="threat-item"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <div
                      className="threat-level-indicator"
                      style={{ backgroundColor: getThreatLevelColor(record.threatAnalysis.level) }}
                    />
                    <div className="threat-info">
                      <div className="threat-domain">{record.domain}</div>
                      <div className="threat-type">{record.threatAnalysis.type}</div>
                      <div className="threat-time">
                        {new Date(record.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Detail View Modal */}
            {selectedRecord && (
              <div className="threat-detail-modal">
                <div className="modal-content">
                  <button
                    className="close-btn"
                    onClick={() => setSelectedRecord(null)}
                  >
                    ✕
                  </button>

                  <h2>Threat Report</h2>

                  <div className="detail-section">
                    <h3>URL</h3>
                    <p className="url">{selectedRecord.url}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Analysis</h3>
                    <p><strong>Level:</strong> {selectedRecord.threatAnalysis.level}</p>
                    <p><strong>Type:</strong> {selectedRecord.threatAnalysis.type}</p>
                    <p><strong>Confidence:</strong> {(selectedRecord.threatAnalysis.confidence * 100).toFixed(0)}%</p>
                    <p><strong>Summary:</strong> {selectedRecord.threatAnalysis.summary}</p>
                  </div>

                  {selectedRecord.threatAnalysis.details.length > 0 && (
                    <div className="detail-section">
                      <h3>Indicators</h3>
                      <ul>
                        {selectedRecord.threatAnalysis.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRecord.screenshot && (
                    <div className="detail-section">
                      <h3>Screenshot</h3>
                      <img
                        src={selectedRecord.screenshot}
                        alt="Page screenshot"
                        className="screenshot"
                      />
                    </div>
                  )}

                  <button
                    className="export-btn"
                    onClick={() => exportReport(selectedRecord.id)}
                  >
                    📄 Export JSON Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-panel">
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.autoAnalysis}
                  onChange={(e) => updateSettings({ autoAnalysis: e.target.checked })}
                />
                Auto-analyze pages
              </label>
              <p className="setting-desc">
                Automatically scan every page you visit
              </p>
            </div>

            <div className="setting-item">
              <label>Sensitivity Level</label>
              <select
                value={settings.sensitivityLevel}
                onChange={(e) => updateSettings({ sensitivityLevel: e.target.value })}
              >
                <option value="low">Low (fewer alerts)</option>
                <option value="medium">Medium (balanced)</option>
                <option value="high">High (more alerts)</option>
              </select>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.autoExit}
                  onChange={(e) => updateSettings({ autoExit: e.target.checked })}
                />
                Auto-exit dangerous sites
              </label>
              <p className="setting-desc">
                Automatically navigate away from high/critical threats
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
```

---

## WebLLM + Gemma 3n Integration

### Model Selection

**Recommended Model:** `gemma-3n-E2B-it-q4f16_1-MLC`

| Property | Value |
|----------|-------|
| Model | Gemma 3n (Instruction-tuned) |
| Quantization | Q4F16_1 (4-bit, efficient) |
| Size | ~2GB download |
| Inference | Fast, runs in browser |
| Use Case | Classification & analysis |

### WebLLM Setup

```typescript
// lib/webllm.ts

import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@anthropic-ai/webllm';

const MODEL_ID = 'gemma-3n-E2B-it-q4f16_1-MLC';

export class LocalLLM {
  private engine: MLCEngine | null = null;
  private isReady: boolean = false;

  async initialize(onProgress?: (progress: InitProgressReport) => void): Promise<void> {
    this.engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: onProgress
    });
    this.isReady = true;
  }

  async analyze(prompt: string): Promise<string> {
    if (!this.engine || !this.isReady) {
      throw new Error('Model not initialized');
    }

    const response = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: SECURITY_ANALYST_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || '';
  }

  get ready(): boolean {
    return this.isReady;
  }
}

const SECURITY_ANALYST_PROMPT = `You are a security analyst AI specialized in detecting web threats.

Your task is to analyze webpage metadata and identify:
- Phishing attempts (fake login pages, credential harvesting)
- Scams (fake offers, prize claims, tech support scams)
- Malware indicators (suspicious scripts, hidden iframes)
- Social engineering (urgency tactics, fear-based messaging)

Always respond in valid JSON format with this structure:
{
  "isThreat": boolean,
  "level": "low" | "medium" | "high" | "critical",
  "type": "phishing" | "scam" | "malware" | "suspicious" | "safe",
  "confidence": number (0.0 to 1.0),
  "summary": "Brief one-sentence explanation",
  "details": ["Specific indicator 1", "Specific indicator 2"]
}

Be conservative - only flag as threat if you have clear evidence.`;
```

---

## Threat Detection System

### Detection Heuristics

The system uses a multi-layered approach:

```typescript
// lib/threatDetection.ts

interface ThreatIndicator {
  type: string;
  weight: number;
  description: string;
}

export function detectHeuristicThreats(metadata: PageMetadata): ThreatIndicator[] {
  const indicators: ThreatIndicator[] = [];

  // === URL ANALYSIS ===

  // Suspicious TLDs
  const suspiciousTLDs = ['.xyz', '.top', '.club', '.work', '.click', '.loan'];
  if (suspiciousTLDs.some(tld => metadata.domain.endsWith(tld))) {
    indicators.push({
      type: 'suspicious_tld',
      weight: 0.3,
      description: `Suspicious top-level domain: ${metadata.domain.split('.').pop()}`
    });
  }

  // Lookalike domains (e.g., g00gle.com, paypa1.com)
  const lookalikePattens = [
    { brand: 'google', pattern: /g[o0]{2}gle|go+gle/i },
    { brand: 'paypal', pattern: /paypa[l1]|paypa1/i },
    { brand: 'amazon', pattern: /amaz[o0]n|amazn/i },
    { brand: 'microsoft', pattern: /micros[o0]ft|mircosoft/i },
    { brand: 'apple', pattern: /app[l1]e|aple/i },
    { brand: 'facebook', pattern: /faceb[o0]{2}k|facebok/i },
    { brand: 'netflix', pattern: /netf[l1]ix|netfix/i },
    { brand: 'bank', pattern: /bank.*secure|secure.*bank/i }
  ];

  for (const { brand, pattern } of lookalikePattens) {
    if (pattern.test(metadata.domain) && !metadata.domain.includes(brand)) {
      indicators.push({
        type: 'lookalike_domain',
        weight: 0.7,
        description: `Domain resembles ${brand} but is not official`
      });
    }
  }

  // Long subdomain chains (used to hide real domain)
  const subdomains = metadata.domain.split('.');
  if (subdomains.length > 4) {
    indicators.push({
      type: 'subdomain_abuse',
      weight: 0.4,
      description: 'Excessive subdomains may hide true domain'
    });
  }

  // === CONTENT ANALYSIS ===

  // Password field on non-HTTPS
  if (metadata.url.startsWith('http://') &&
      metadata.domStructure.inputFields.some(f => f.isPassword)) {
    indicators.push({
      type: 'insecure_password',
      weight: 0.8,
      description: 'Password field on non-HTTPS connection'
    });
  }

  // Form submits to different domain
  for (const form of metadata.forms) {
    if (form.isExternal && form.hasPasswordField) {
      indicators.push({
        type: 'external_form_submission',
        weight: 0.7,
        description: 'Password form submits to external domain'
      });
    }
  }

  // Hidden iframes
  const hiddenIframes = metadata.iframes.filter(i => i.isHidden);
  if (hiddenIframes.length > 0) {
    indicators.push({
      type: 'hidden_iframe',
      weight: 0.5,
      description: `${hiddenIframes.length} hidden iframe(s) detected`
    });
  }

  // Obfuscated scripts
  const obfuscatedScripts = metadata.scripts.filter(s => s.hasObfuscation);
  if (obfuscatedScripts.length > 0) {
    indicators.push({
      type: 'obfuscated_code',
      weight: 0.4,
      description: `${obfuscatedScripts.length} script(s) with obfuscation`
    });
  }

  // Urgency/fear patterns (from content script detection)
  for (const pattern of metadata.domStructure.suspiciousPatterns) {
    if (pattern.startsWith('URGENCY:')) {
      indicators.push({
        type: 'urgency_tactic',
        weight: 0.3,
        description: pattern
      });
    }
    if (pattern.startsWith('FINANCIAL:')) {
      indicators.push({
        type: 'financial_request',
        weight: 0.4,
        description: pattern
      });
    }
  }

  return indicators;
}

export function calculateThreatScore(indicators: ThreatIndicator[]): number {
  if (indicators.length === 0) return 0;

  // Weighted average with diminishing returns
  let totalWeight = 0;
  let weightedSum = 0;

  for (const indicator of indicators) {
    weightedSum += indicator.weight;
    totalWeight += 1;
  }

  // Normalize to 0-1 range, with bonus for multiple indicators
  const baseScore = weightedSum / totalWeight;
  const countBonus = Math.min(0.2, indicators.length * 0.05);

  return Math.min(1, baseScore + countBonus);
}
```

---

## Warning Overlay System

### CSS Styling

```css
/* sentinel-overlay.css */

#sentinel-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sentinel-warning-container {
  background: #1a1a2e;
  border: 3px solid #dc2626;
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 0 60px rgba(220, 38, 38, 0.5);
  animation: sentinel-pulse 2s infinite;
}

@keyframes sentinel-pulse {
  0%, 100% { box-shadow: 0 0 60px rgba(220, 38, 38, 0.5); }
  50% { box-shadow: 0 0 80px rgba(220, 38, 38, 0.8); }
}

.sentinel-warning-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.sentinel-warning-title {
  color: #dc2626;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.sentinel-warning-message {
  color: #e5e5e5;
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 20px;
}

.sentinel-warning-details {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  color: #a3a3a3;
  font-size: 14px;
  text-align: left;
  margin-bottom: 24px;
}

.sentinel-warning-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.sentinel-btn-exit {
  background: #dc2626;
  color: white;
  border: none;
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.sentinel-btn-exit:hover {
  background: #b91c1c;
}

.sentinel-btn-continue {
  background: transparent;
  color: #737373;
  border: 1px solid #525252;
  padding: 14px 28px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.sentinel-btn-continue:hover {
  border-color: #737373;
  color: #a3a3a3;
}

.sentinel-warning-footer {
  color: #525252;
  font-size: 12px;
  margin-top: 20px;
}
```

---

## Evidence Collection & Storage

### IndexedDB Schema

```typescript
// lib/storage.ts

interface EvidenceDB {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  screenshot: Blob;
  domSnapshot: string;
  metadata: PageMetadata;
  threatAnalysis: ThreatAnalysisResult;
  networkLogs: NetworkLog[];
  exported: boolean;
}

const DB_NAME = 'SentinelEvidence';
const DB_VERSION = 1;
const STORE_NAME = 'evidence';

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('domain', 'domain');
        store.createIndex('threatLevel', 'threatAnalysis.level');
      }
    };
  });
}

export async function saveEvidence(evidence: EvidenceDB): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(evidence);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getEvidenceList(): Promise<EvidenceDB[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

export async function getEvidenceById(id: string): Promise<EvidenceDB | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteEvidence(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

---

## JSON Report Format

### Report Structure

```typescript
// lib/report.ts

interface SentinelReport {
  version: string;
  generatedAt: string;
  generatedBy: string;

  incident: {
    id: string;
    detectedAt: string;
    url: string;
    domain: string;
  };

  threatAssessment: {
    level: string;
    type: string;
    confidence: number;
    summary: string;
    indicators: Array<{
      type: string;
      description: string;
      severity: string;
    }>;
  };

  evidence: {
    screenshotCaptured: boolean;
    screenshotBase64?: string;
    domSnapshotCaptured: boolean;
    domSnapshotSize?: number;
    networkLogsCount: number;
  };

  pageAnalysis: {
    title: string;
    formsCount: number;
    passwordFieldsCount: number;
    externalLinksCount: number;
    iframesCount: number;
    hiddenElementsCount: number;
    suspiciousPatterns: string[];
  };

  metadata: {
    browserInfo: string;
    extensionVersion: string;
    analysisMethod: string;
  };
}

export function generateReport(evidence: EvidenceDB): SentinelReport {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedBy: 'Perplexica Sentinel Mode',

    incident: {
      id: evidence.id,
      detectedAt: new Date(evidence.timestamp).toISOString(),
      url: evidence.url,
      domain: evidence.domain
    },

    threatAssessment: {
      level: evidence.threatAnalysis.level,
      type: evidence.threatAnalysis.type,
      confidence: evidence.threatAnalysis.confidence,
      summary: evidence.threatAnalysis.summary,
      indicators: evidence.threatAnalysis.details.map(detail => ({
        type: 'detected_pattern',
        description: detail,
        severity: evidence.threatAnalysis.level
      }))
    },

    evidence: {
      screenshotCaptured: !!evidence.screenshot,
      screenshotBase64: evidence.screenshot ?
        btoa(String.fromCharCode(...new Uint8Array(await evidence.screenshot.arrayBuffer()))) :
        undefined,
      domSnapshotCaptured: !!evidence.domSnapshot,
      domSnapshotSize: evidence.domSnapshot?.length || 0,
      networkLogsCount: evidence.networkLogs?.length || 0
    },

    pageAnalysis: {
      title: evidence.metadata.title,
      formsCount: evidence.metadata.forms.length,
      passwordFieldsCount: evidence.metadata.domStructure.inputFields.filter(f => f.isPassword).length,
      externalLinksCount: evidence.metadata.externalLinks.length,
      iframesCount: evidence.metadata.iframes.length,
      hiddenElementsCount: evidence.metadata.iframes.filter(i => i.isHidden).length,
      suspiciousPatterns: evidence.metadata.domStructure.suspiciousPatterns
    },

    metadata: {
      browserInfo: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      analysisMethod: 'WebLLM Gemma 3n + Heuristics'
    }
  };
}
```

---

## Perplexica Backend Integration

### API Endpoints (Nice-to-Have)

When ready to add cloud features, add these endpoints to Perplexica:

```typescript
// src/app/api/sentinel/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { screenshot, metadata, localAnalysis } = await req.json();

  // Use Gemini 2.5 Pro Vision for deep analysis
  // This is triggered when local analysis is uncertain

  // ... implementation

  return NextResponse.json({
    deepAnalysis: result,
    virustotalResults: vtResults,
    recommendation: 'block' | 'warn' | 'allow'
  });
}

// src/app/api/sentinel/virustotal/route.ts

export async function POST(req: NextRequest) {
  const { url, fileHash } = await req.json();

  // Query VirusTotal API
  // ... implementation

  return NextResponse.json({
    reputation: score,
    detections: detectionList,
    categories: categoryList
  });
}

// src/app/api/sentinel/report/route.ts

export async function POST(req: NextRequest) {
  const { evidence, format } = await req.json();

  // Generate human-readable report for law enforcement
  // ... implementation using LLM to format

  return NextResponse.json({
    report: formattedReport,
    format: 'pdf' | 'docx' | 'txt'
  });
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task | Description |
|------|-------------|
| ✅ Create extension scaffold | manifest.json, folder structure |
| ✅ Set up content script | Basic DOM extraction, message passing |
| ✅ Set up background worker | Message routing, storage |
| ✅ Create sidepanel UI | React setup, basic layout |
| ✅ Implement screenshot capture | chrome.tabs.captureVisibleTab |

**Deliverable:** Extension that can capture page info and display in sidepanel

### Phase 2: Local AI (Week 3-4)

| Task | Description |
|------|-------------|
| ⬜ Integrate WebLLM | Load Gemma 3n in background worker |
| ⬜ Create analysis prompts | Optimize for threat detection |
| ⬜ Implement heuristics | URL, DOM, content pattern detection |
| ⬜ Combine LLM + heuristics | Weighted scoring system |

**Deliverable:** Working local threat detection

### Phase 3: Protection Features (Week 5-6)

| Task | Description |
|------|-------------|
| ⬜ Warning overlay | Full-screen warning with styling |
| ⬜ Exit functionality | Safe navigation away from threats |
| ⬜ Auto-detection toggle | Settings for auto vs manual |
| ⬜ Sensitivity levels | Adjustable detection thresholds |

**Deliverable:** Complete protection workflow

### Phase 4: Evidence & Reporting (Week 7-8)

| Task | Description |
|------|-------------|
| ⬜ IndexedDB storage | Persistent evidence storage |
| ⬜ JSON report generation | Structured export format |
| ⬜ Evidence viewer | Screenshot + details in sidepanel |
| ⬜ Export functionality | Download reports |

**Deliverable:** Full evidence collection and export

### Phase 5: Polish & Integration (Week 9-10)

| Task | Description |
|------|-------------|
| ⬜ Performance optimization | Lazy loading, memory management |
| ⬜ Error handling | Graceful failures, recovery |
| ⬜ Perplexica mode integration | Add as mode option in main app |
| ⬜ Testing | Various phishing/scam scenarios |

**Deliverable:** Production-ready extension

### Phase 6: Nice-to-Have Features (Post-MVP)

| Task | Description |
|------|-------------|
| ⬜ Gemini 2.5 cloud analysis | Deep analysis for uncertain cases |
| ⬜ VirusTotal integration | File/URL reputation |
| ⬜ Human-readable reports | LLM-formatted for law enforcement |
| ⬜ Threat pattern updates | Downloadable signature updates |

---

## File Structure

```
perplexica/
├── src/
│   └── ... (existing Perplexica code)
│
└── sentinel-extension/
    ├── manifest.json
    ├── package.json
    ├── tsconfig.json
    ├── webpack.config.js
    │
    ├── src/
    │   ├── background/
    │   │   ├── index.ts              # Service worker entry
    │   │   ├── webllm.ts             # WebLLM initialization
    │   │   ├── analyzer.ts           # Threat analysis logic
    │   │   ├── storage.ts            # IndexedDB operations
    │   │   └── screenshot.ts         # Screenshot capture
    │   │
    │   ├── content/
    │   │   ├── index.ts              # Content script entry
    │   │   ├── domExtractor.ts       # DOM analysis
    │   │   ├── overlay.ts            # Warning overlay
    │   │   └── sentinel-overlay.css  # Overlay styles
    │   │
    │   ├── sidepanel/
    │   │   ├── index.html            # Sidepanel HTML
    │   │   ├── index.tsx             # React entry
    │   │   ├── App.tsx               # Main component
    │   │   ├── components/
    │   │   │   ├── ThreatList.tsx
    │   │   │   ├── ThreatDetail.tsx
    │   │   │   ├── Settings.tsx
    │   │   │   └── ModelStatus.tsx
    │   │   └── styles/
    │   │       └── sidepanel.css
    │   │
    │   ├── lib/
    │   │   ├── types.ts              # Shared types
    │   │   ├── messages.ts           # Message definitions
    │   │   ├── heuristics.ts         # Detection patterns
    │   │   ├── report.ts             # Report generation
    │   │   └── constants.ts          # Configuration
    │   │
    │   └── assets/
    │       └── icons/
    │           ├── sentinel-16.png
    │           ├── sentinel-48.png
    │           └── sentinel-128.png
    │
    ├── public/
    │   └── models/                   # WebLLM model files (downloaded)
    │
    └── dist/                         # Built extension
```

---

## Summary

This implementation plan provides a complete roadmap for building Sentinel Mode as a Chrome extension that integrates with Perplexica. The key principles are:

1. **Privacy-first**: Local AI (Gemma 3n) handles all analysis by default
2. **Passive observation**: No browser automation, just monitoring and alerting
3. **Evidence preservation**: Screenshots and DOM snapshots for forensic use
4. **User protection**: Clear warnings and easy exit from threats
5. **Extensibility**: Backend integration ready for future cloud features

The MVP can be completed in approximately 8-10 weeks, with nice-to-have features added afterward.
