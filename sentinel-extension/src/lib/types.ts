// ===== Page Metadata =====

export interface PageMetadata {
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

export interface DOMStructure {
  totalElements: number;
  formCount: number;
  inputFields: InputFieldInfo[];
  suspiciousPatterns: string[];
}

export interface InputFieldInfo {
  type: string;
  name: string;
  placeholder: string;
  isPassword: boolean;
  isHidden: boolean;
}

export interface FormInfo {
  action: string;
  method: string;
  hasPasswordField: boolean;
  inputCount: number;
  isExternal: boolean;
}

export interface LinkInfo {
  href: string;
  text: string;
  isHidden: boolean;
}

export interface ScriptInfo {
  src: string;
  isExternal: boolean;
  hasObfuscation: boolean;
}

export interface IframeInfo {
  src: string;
  isHidden: boolean;
  isExternal: boolean;
}

// ===== Threat Analysis =====

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatType =
  | 'phishing'
  | 'scam'
  | 'malware'
  | 'suspicious'
  | 'safe';

export interface ThreatAnalysisResult {
  isThreat: boolean;
  level: ThreatLevel;
  type: ThreatType;
  confidence: number;
  summary: string;
  details: string[];
}

export interface ThreatIndicator {
  type: string;
  weight: number;
  description: string;
}

// ===== Evidence =====

export interface EvidenceRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  screenshot: string; // base64 data URL
  domSnapshot: string;
  metadata: PageMetadata;
  threatAnalysis: ThreatAnalysisResult;
  exported: boolean;
}

// ===== Reports =====

export interface SentinelReport {
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
    level: ThreatLevel;
    type: ThreatType;
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
    domSnapshotCaptured: boolean;
    domSnapshotSize: number;
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

// ===== Settings =====

export interface SentinelSettings {
  autoAnalysis: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  autoExit: boolean;
}

// ===== Model Status =====

export interface ModelStatus {
  loaded: boolean;
  model: string;
  loadingProgress: number;
}
