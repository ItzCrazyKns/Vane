import type { EvidenceRecord, SentinelReport } from './types';

export function generateReport(evidence: EvidenceRecord): SentinelReport {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedBy: 'Perplexica Sentinel Mode',

    incident: {
      id: evidence.id,
      detectedAt: new Date(evidence.timestamp).toISOString(),
      url: evidence.url,
      domain: evidence.domain,
    },

    threatAssessment: {
      level: evidence.threatAnalysis.level,
      type: evidence.threatAnalysis.type,
      confidence: evidence.threatAnalysis.confidence,
      summary: evidence.threatAnalysis.summary,
      indicators: evidence.threatAnalysis.details.map((detail) => ({
        type: 'detected_pattern',
        description: detail,
        severity: evidence.threatAnalysis.level,
      })),
    },

    evidence: {
      screenshotCaptured: !!evidence.screenshot,
      domSnapshotCaptured: !!evidence.domSnapshot,
      domSnapshotSize: evidence.domSnapshot?.length ?? 0,
    },

    pageAnalysis: {
      title: evidence.metadata.title,
      formsCount: evidence.metadata.forms.length,
      passwordFieldsCount: evidence.metadata.domStructure.inputFields.filter(
        (f) => f.isPassword,
      ).length,
      externalLinksCount: evidence.metadata.externalLinks.length,
      iframesCount: evidence.metadata.iframes.length,
      hiddenElementsCount: evidence.metadata.iframes.filter((i) => i.isHidden)
        .length,
      suspiciousPatterns: evidence.metadata.domStructure.suspiciousPatterns,
    },

    metadata: {
      browserInfo: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      analysisMethod: 'Heuristics + Local LLM (Gemma 3n)',
    },
  };
}
