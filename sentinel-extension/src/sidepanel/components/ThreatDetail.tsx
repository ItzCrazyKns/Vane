import React from 'react';
import type { EvidenceRecord } from '../../lib/types';

interface Props {
  record: EvidenceRecord;
  onBack: () => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}

const ThreatDetail: React.FC<Props> = ({
  record,
  onBack,
  onExport,
  onDelete,
}) => {
  return (
    <div className="sp-detail">
      <button className="sp-detail-back" onClick={onBack}>
        &#x2190; Back
      </button>

      <h2 className="sp-detail-title">Threat Report</h2>

      {/* URL */}
      <section className="sp-detail-section">
        <h3>URL</h3>
        <p className="sp-detail-url">{record.url}</p>
      </section>

      {/* Analysis */}
      <section className="sp-detail-section">
        <h3>Analysis</h3>
        <div className="sp-detail-grid">
          <span className="sp-detail-label">Level</span>
          <span className={`sp-detail-value sp-level--${record.threatAnalysis.level}`}>
            {record.threatAnalysis.level}
          </span>

          <span className="sp-detail-label">Type</span>
          <span className="sp-detail-value">{record.threatAnalysis.type}</span>

          <span className="sp-detail-label">Confidence</span>
          <span className="sp-detail-value">
            {(record.threatAnalysis.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p className="sp-detail-summary">{record.threatAnalysis.summary}</p>
      </section>

      {/* Indicators */}
      {record.threatAnalysis.details.length > 0 && (
        <section className="sp-detail-section">
          <h3>Indicators</h3>
          <ul className="sp-detail-indicators">
            {record.threatAnalysis.details.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Screenshot */}
      {record.screenshot && (
        <section className="sp-detail-section">
          <h3>Screenshot</h3>
          <img
            src={record.screenshot}
            alt="Page screenshot at time of detection"
            className="sp-detail-screenshot"
          />
        </section>
      )}

      {/* Detected At */}
      <section className="sp-detail-section">
        <h3>Detected At</h3>
        <p>{new Date(record.timestamp).toLocaleString()}</p>
      </section>

      {/* Actions */}
      <div className="sp-detail-actions">
        <button
          className="sp-btn sp-btn--primary"
          onClick={() => onExport(record.id)}
        >
          Export JSON Report
        </button>
        <button
          className="sp-btn sp-btn--danger"
          onClick={() => onDelete(record.id)}
        >
          Delete Evidence
        </button>
      </div>
    </div>
  );
};

export default ThreatDetail;
