import React, { useState, useEffect, useCallback } from 'react';
import type { EvidenceRecord, SentinelSettings } from '../lib/types';
import ThreatList from './components/ThreatList';
import ThreatDetail from './components/ThreatDetail';
import Settings from './components/Settings';
import ModelStatus from './components/ModelStatus';

type Tab = 'threats' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('threats');
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(
    null,
  );
  const [settings, setSettings] = useState<SentinelSettings>({
    autoAnalysis: true,
    sensitivityLevel: 'medium',
    autoExit: false,
  });
  const [modelStatus, setModelStatus] = useState({
    loaded: false,
    model: '',
    loadingProgress: 0,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Load initial data ---

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_EVIDENCE_LIST' }, (resp) => {
      if (chrome.runtime.lastError) {
        setError('Failed to load evidence records');
        return;
      }
      if (resp?.records) setRecords(resp.records);
    });
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (resp) => {
      if (!chrome.runtime.lastError && resp?.settings) setSettings(resp.settings);
    });
    chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' }, (resp) => {
      if (!chrome.runtime.lastError && resp) setModelStatus(resp);
    });
  }, []);

  // --- Listen for real-time updates ---

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'NEW_EVIDENCE') {
        setRecords((prev) => [message.payload, ...prev]);
      }
      if (message.type === 'ANALYSIS_STATUS') {
        setAnalyzing(message.payload.analyzing);
      }
      if (message.type === 'MODEL_LOADING_PROGRESS') {
        setModelStatus((prev) => ({
          ...prev,
          loadingProgress: message.payload.progress,
        }));
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // --- Actions ---

  const handleAnalyzeCurrentPage = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_MANUAL_ANALYSIS' });
  }, []);

  const handleUpdateSettings = useCallback(
    (patch: Partial<SentinelSettings>) => {
      const updated = { ...settings, ...patch };
      setSettings(updated);
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch });
    },
    [settings],
  );

  const handleExportReport = useCallback((id: string) => {
    chrome.runtime.sendMessage(
      { type: 'EXPORT_REPORT', payload: { id } },
      (resp) => {
        if (resp?.report) {
          const blob = new Blob([resp.report], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sentinel-report-${id}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
    );
  }, []);

  const handleDeleteRecord = useCallback((id: string) => {
    chrome.runtime.sendMessage(
      { type: 'DELETE_EVIDENCE', payload: { id } },
      () => {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setSelectedRecord(null);
      },
    );
  }, []);

  // --- Render ---

  return (
    <div className="sp-root">
      {/* Header */}
      <header className="sp-header">
        <div className="sp-header-title">
          <span className="sp-shield">&#x1f6e1;</span>
          <h1>Sentinel Mode</h1>
        </div>
        <ModelStatus status={modelStatus} />
      </header>

      {/* Tabs */}
      <nav className="sp-tabs">
        <button
          className={`sp-tab ${activeTab === 'threats' ? 'sp-tab--active' : ''}`}
          onClick={() => {
            setActiveTab('threats');
            setSelectedRecord(null);
          }}
        >
          Threats ({records.length})
        </button>
        <button
          className={`sp-tab ${activeTab === 'settings' ? 'sp-tab--active' : ''}`}
          onClick={() => {
            setActiveTab('settings');
            setSelectedRecord(null);
          }}
        >
          Settings
        </button>
      </nav>

      {/* Error Banner */}
      {error && (
        <div className="sp-error-banner" onClick={() => setError(null)}>
          {error} <span style={{ marginLeft: 8, cursor: 'pointer' }}>&#x2715;</span>
        </div>
      )}

      {/* Content */}
      <main className="sp-content">
        {activeTab === 'threats' && !selectedRecord && (
          <ThreatList
            records={records}
            analyzing={analyzing}
            onSelect={setSelectedRecord}
            onAnalyze={handleAnalyzeCurrentPage}
          />
        )}

        {activeTab === 'threats' && selectedRecord && (
          <ThreatDetail
            record={selectedRecord}
            onBack={() => setSelectedRecord(null)}
            onExport={handleExportReport}
            onDelete={handleDeleteRecord}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdate={handleUpdateSettings}
          />
        )}
      </main>
    </div>
  );
};

export default App;
