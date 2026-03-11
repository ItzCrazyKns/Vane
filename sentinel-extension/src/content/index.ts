import type {
  PageMetadata,
  DOMStructure,
  InputFieldInfo,
  FormInfo,
  LinkInfo,
  ScriptInfo,
  IframeInfo,
} from '../lib/types';
import type { ShowWarningMessage } from '../lib/messages';
import {
  URGENCY_KEYWORDS,
  FINANCIAL_KEYWORDS,
  OBFUSCATION_PATTERNS,
} from '../lib/constants';

class SentinelContentScript {
  private overlayActive = false;

  constructor() {
    this.init();
  }

  private init(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    const metadata = this.extractPageMetadata();
    chrome.runtime.sendMessage({
      type: 'PAGE_LOADED',
      payload: metadata,
    });
  }

  // ===== DOM Extraction =====

  private extractPageMetadata(): PageMetadata {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      timestamp: Date.now(),
      domStructure: this.analyzeDOMStructure(),
      forms: this.extractForms(),
      externalLinks: this.extractExternalLinks(),
      scripts: this.extractScripts(),
      iframes: this.extractIframes(),
    };
  }

  private analyzeDOMStructure(): DOMStructure {
    const inputs = document.querySelectorAll('input');
    const inputFields: InputFieldInfo[] = [];

    inputs.forEach((input) => {
      inputFields.push({
        type: input.type,
        name: input.name,
        placeholder: input.placeholder,
        isPassword: input.type === 'password',
        isHidden:
          input.type === 'hidden' ||
          window.getComputedStyle(input).display === 'none',
      });
    });

    return {
      totalElements: document.querySelectorAll('*').length,
      formCount: document.forms.length,
      inputFields,
      suspiciousPatterns: this.detectSuspiciousPatterns(),
    };
  }

  private detectSuspiciousPatterns(): string[] {
    const patterns: string[] = [];
    const bodyText = document.body?.innerText?.toLowerCase() || '';

    for (const term of URGENCY_KEYWORDS) {
      if (bodyText.includes(term)) {
        patterns.push(`URGENCY: "${term}"`);
      }
    }

    for (const term of FINANCIAL_KEYWORDS) {
      if (bodyText.includes(term)) {
        patterns.push(`FINANCIAL: "${term}"`);
      }
    }

    if (
      window.location.protocol !== 'https:' &&
      document.querySelector('input[type="password"]')
    ) {
      patterns.push('SECURITY: Password field on non-HTTPS page');
    }

    return patterns;
  }

  private extractForms(): FormInfo[] {
    const forms: FormInfo[] = [];
    document.querySelectorAll('form').forEach((form) => {
      forms.push({
        action: form.action,
        method: form.method,
        hasPasswordField: !!form.querySelector('input[type="password"]'),
        inputCount: form.querySelectorAll('input').length,
        isExternal: form.action
          ? !form.action.includes(window.location.hostname)
          : false,
      });
    });
    return forms;
  }

  private static readonly MAX_EXTERNAL_LINKS = 50;

  private extractExternalLinks(): LinkInfo[] {
    const links: LinkInfo[] = [];
    const anchors = document.querySelectorAll('a[href]');
    for (let i = 0; i < anchors.length && links.length < SentinelContentScript.MAX_EXTERNAL_LINKS; i++) {
      const a = anchors[i] as HTMLAnchorElement;
      try {
        if (a.hostname && a.hostname !== window.location.hostname) {
          links.push({
            href: a.href,
            text: a.innerText.substring(0, 100),
            isHidden: window.getComputedStyle(a).display === 'none',
          });
        }
      } catch {
        // skip invalid hrefs
      }
    }
    return links;
  }

  private static readonly MAX_SCRIPTS = 50;

  private extractScripts(): ScriptInfo[] {
    const scripts: ScriptInfo[] = [];
    const scriptEls = document.querySelectorAll('script');
    for (let i = 0; i < scriptEls.length && scripts.length < SentinelContentScript.MAX_SCRIPTS; i++) {
      const script = scriptEls[i];
      scripts.push({
        src: script.src || '[inline]',
        isExternal:
          !!script.src && !script.src.includes(window.location.hostname),
        hasObfuscation: this.detectObfuscation(script.textContent || ''),
      });
    }
    return scripts;
  }

  private detectObfuscation(code: string): boolean {
    return OBFUSCATION_PATTERNS.some((pattern) => pattern.test(code));
  }

  private extractIframes(): IframeInfo[] {
    const iframes: IframeInfo[] = [];
    document.querySelectorAll('iframe').forEach((iframe) => {
      iframes.push({
        src: iframe.src,
        isHidden:
          iframe.width === '0' ||
          iframe.height === '0' ||
          window.getComputedStyle(iframe).display === 'none',
        isExternal:
          !!iframe.src && !iframe.src.includes(window.location.hostname),
      });
    });
    return iframes;
  }

  // ===== Warning Overlay =====

  private showWarningOverlay(threat: ShowWarningMessage['payload']): void {
    if (this.overlayActive) return;
    this.overlayActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'sentinel-warning-overlay';
    overlay.innerHTML = `
      <div class="sentinel-warning-container">
        <div class="sentinel-warning-icon">&#9888;</div>
        <h1 class="sentinel-warning-title">Potential Threat Detected</h1>
        <p class="sentinel-warning-message">${this.escapeHtml(threat.summary)}</p>
        <div class="sentinel-warning-details">
          <strong>Threat Level:</strong> ${this.escapeHtml(threat.level)}<br>
          <strong>Type:</strong> ${this.escapeHtml(threat.type)}<br>
          <strong>Confidence:</strong> ${(threat.confidence * 100).toFixed(0)}%
        </div>
        <div class="sentinel-warning-actions">
          <button id="sentinel-exit-btn" class="sentinel-btn-exit">
            Exit This Site
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

    document.getElementById('sentinel-exit-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'EXIT_SITE' });
    });

    document.getElementById('sentinel-continue-btn')?.addEventListener('click', () => {
      overlay.remove();
      this.overlayActive = false;
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  private removeWarningOverlay(): void {
    const overlay = document.getElementById('sentinel-warning-overlay');
    if (overlay) {
      overlay.remove();
      this.overlayActive = false;
    }
  }

  // ===== Message Handling =====

  private handleMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
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
        const metadata = this.extractPageMetadata();
        chrome.runtime.sendMessage({
          type: 'MANUAL_ANALYSIS',
          payload: metadata,
        });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return true;
  }
}

new SentinelContentScript();
