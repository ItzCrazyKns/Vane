import type { PageMetadata, ThreatIndicator } from './types';
import {
  SUSPICIOUS_TLDS,
  LOOKALIKE_PATTERNS,
} from './constants';

/**
 * Run heuristic checks against page metadata.
 * Returns a list of weighted threat indicators.
 */
export function detectHeuristicThreats(
  metadata: PageMetadata,
): ThreatIndicator[] {
  const indicators: ThreatIndicator[] = [];

  // --- URL Analysis ---

  if (SUSPICIOUS_TLDS.some((tld) => metadata.domain.endsWith(tld))) {
    indicators.push({
      type: 'suspicious_tld',
      weight: 0.3,
      description: `Suspicious top-level domain: .${metadata.domain.split('.').pop()}`,
    });
  }

  for (const { brand, pattern } of LOOKALIKE_PATTERNS) {
    if (pattern.test(metadata.domain) && !metadata.domain.includes(brand)) {
      indicators.push({
        type: 'lookalike_domain',
        weight: 0.7,
        description: `Domain resembles "${brand}" but is not official`,
      });
    }
  }

  const subdomains = metadata.domain.split('.');
  if (subdomains.length > 4) {
    indicators.push({
      type: 'subdomain_abuse',
      weight: 0.4,
      description: 'Excessive subdomains may hide the true domain',
    });
  }

  // --- Content Analysis ---

  if (
    metadata.url.startsWith('http://') &&
    metadata.domStructure.inputFields.some((f) => f.isPassword)
  ) {
    indicators.push({
      type: 'insecure_password',
      weight: 0.8,
      description: 'Password field on non-HTTPS connection',
    });
  }

  for (const form of metadata.forms) {
    if (form.isExternal && form.hasPasswordField) {
      indicators.push({
        type: 'external_form_submission',
        weight: 0.7,
        description: 'Password form submits to external domain',
      });
    }
  }

  const hiddenIframes = metadata.iframes.filter((i) => i.isHidden);
  if (hiddenIframes.length > 0) {
    indicators.push({
      type: 'hidden_iframe',
      weight: 0.5,
      description: `${hiddenIframes.length} hidden iframe(s) detected`,
    });
  }

  const obfuscatedScripts = metadata.scripts.filter((s) => s.hasObfuscation);
  if (obfuscatedScripts.length > 0) {
    indicators.push({
      type: 'obfuscated_code',
      weight: 0.4,
      description: `${obfuscatedScripts.length} script(s) with obfuscation patterns`,
    });
  }

  // --- Suspicious text patterns (already extracted by content script) ---

  for (const pattern of metadata.domStructure.suspiciousPatterns) {
    if (pattern.startsWith('URGENCY:')) {
      indicators.push({ type: 'urgency_tactic', weight: 0.3, description: pattern });
    }
    if (pattern.startsWith('FINANCIAL:')) {
      indicators.push({ type: 'financial_request', weight: 0.4, description: pattern });
    }
    if (pattern.startsWith('SECURITY:')) {
      indicators.push({ type: 'security_issue', weight: 0.6, description: pattern });
    }
  }

  return indicators;
}

/**
 * Collapse indicators into a 0-1 threat score.
 */
export function calculateThreatScore(indicators: ThreatIndicator[]): number {
  if (indicators.length === 0) return 0;

  let weightedSum = 0;
  for (const ind of indicators) {
    weightedSum += ind.weight;
  }

  const baseScore = weightedSum / indicators.length;
  const countBonus = Math.min(0.2, indicators.length * 0.05);

  return Math.min(1, baseScore + countBonus);
}
