import type {
  PageMetadata,
  ThreatAnalysisResult,
  EvidenceRecord,
  SentinelSettings,
  ModelStatus,
} from './types';

// ===== Content Script → Background =====

export interface PageLoadedMessage {
  type: 'PAGE_LOADED';
  payload: PageMetadata;
}

export interface ManualAnalysisMessage {
  type: 'MANUAL_ANALYSIS';
  payload: PageMetadata;
}

export interface ExitSiteMessage {
  type: 'EXIT_SITE';
}

// ===== Background → Content Script =====

export interface ShowWarningMessage {
  type: 'SHOW_WARNING';
  payload: {
    level: string;
    type: string;
    confidence: number;
    summary: string;
  };
}

export interface GetDOMMessage {
  type: 'GET_DOM';
}

export interface AnalyzeNowMessage {
  type: 'ANALYZE_NOW';
}

// ===== Sidepanel → Background =====

export interface GetEvidenceListMessage {
  type: 'GET_EVIDENCE_LIST';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface UpdateSettingsMessage {
  type: 'UPDATE_SETTINGS';
  payload: Partial<SentinelSettings>;
}

export interface ExportReportMessage {
  type: 'EXPORT_REPORT';
  payload: { id: string };
}

export interface GetModelStatusMessage {
  type: 'GET_MODEL_STATUS';
}

export interface TriggerManualAnalysisMessage {
  type: 'TRIGGER_MANUAL_ANALYSIS';
}

export interface DeleteEvidenceMessage {
  type: 'DELETE_EVIDENCE';
  payload: { id: string };
}

// ===== Background → Sidepanel =====

export interface NewEvidenceMessage {
  type: 'NEW_EVIDENCE';
  payload: EvidenceRecord;
}

export interface ModelLoadingProgressMessage {
  type: 'MODEL_LOADING_PROGRESS';
  payload: { progress: number; text: string };
}

export interface AnalysisStatusMessage {
  type: 'ANALYSIS_STATUS';
  payload: { analyzing: boolean; url?: string };
}

// ===== Union Types =====

export type ContentToBackgroundMessage =
  | PageLoadedMessage
  | ManualAnalysisMessage
  | ExitSiteMessage;

export type BackgroundToContentMessage =
  | ShowWarningMessage
  | GetDOMMessage
  | AnalyzeNowMessage;

export type SidepanelToBackgroundMessage =
  | GetEvidenceListMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | ExportReportMessage
  | GetModelStatusMessage
  | TriggerManualAnalysisMessage
  | DeleteEvidenceMessage;

export type BackgroundToSidepanelMessage =
  | NewEvidenceMessage
  | ModelLoadingProgressMessage
  | AnalysisStatusMessage;

export type SentinelMessage =
  | ContentToBackgroundMessage
  | BackgroundToContentMessage
  | SidepanelToBackgroundMessage
  | BackgroundToSidepanelMessage;
