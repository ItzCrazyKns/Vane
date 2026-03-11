import React from 'react';
import type { EvidenceRecord } from '../../lib/types';

interface Props {
  records: EvidenceRecord[];
  analyzing: boolean;
  onSelect: (record: EvidenceRecord) => void;
  onAnalyze: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
};

const ThreatList: React.FC<Props> = ({
  records,
  analyzing,
  onSelect,
  onAnalyze,
}) => {
  return (
    <div className="sp-threats">
      <button
        className="sp-analyze-btn"
        onClick={onAnalyze}
        disabled={analyzing}
      >
        {analyzing ? 'Analyzing...' : 'Analyze Current Page'}
      </button>

      {records.length === 0 ? (
        <div className="sp-empty">
          <p className="sp-empty-title">No threats detected yet</p>
          <p className="sp-empty-sub">
            Sentinel is monitoring your browsing activity.
          </p>
        </div>
      ) : (
        <ul className="sp-threat-list">
          {records.map((record) => (
            <li
              key={record.id}
              className="sp-threat-item"
              onClick={() => onSelect(record)}
            >
              <div
                className="sp-threat-indicator"
                style={{
                  backgroundColor:
                    LEVEL_COLORS[record.threatAnalysis.level] || '#6b7280',
                }}
              />
              <div className="sp-threat-info">
                <div className="sp-threat-domain">{record.domain}</div>
                <div className="sp-threat-type">
                  {record.threatAnalysis.type} &middot;{' '}
                  {record.threatAnalysis.level}
                </div>
                <div className="sp-threat-time">
                  {new Date(record.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="sp-threat-chevron">&#x203A;</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ThreatList;
