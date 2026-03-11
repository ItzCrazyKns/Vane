import React from 'react';
import type { SentinelSettings } from '../../lib/types';

interface Props {
  settings: SentinelSettings;
  onUpdate: (patch: Partial<SentinelSettings>) => void;
}

const Settings: React.FC<Props> = ({ settings, onUpdate }) => {
  return (
    <div className="sp-settings">
      {/* Auto-analyze */}
      <div className="sp-setting-item">
        <label className="sp-setting-toggle">
          <input
            type="checkbox"
            checked={settings.autoAnalysis}
            onChange={(e) => onUpdate({ autoAnalysis: e.target.checked })}
          />
          <span>Auto-analyze pages</span>
        </label>
        <p className="sp-setting-desc">
          Automatically scan every page you visit.
        </p>
      </div>

      {/* Sensitivity */}
      <div className="sp-setting-item">
        <label className="sp-setting-label">Sensitivity Level</label>
        <select
          className="sp-setting-select"
          value={settings.sensitivityLevel}
          onChange={(e) =>
            onUpdate({
              sensitivityLevel: e.target.value as SentinelSettings['sensitivityLevel'],
            })
          }
        >
          <option value="low">Low (fewer alerts)</option>
          <option value="medium">Medium (balanced)</option>
          <option value="high">High (more alerts)</option>
        </select>
      </div>

      {/* Auto-exit */}
      <div className="sp-setting-item">
        <label className="sp-setting-toggle">
          <input
            type="checkbox"
            checked={settings.autoExit}
            onChange={(e) => onUpdate({ autoExit: e.target.checked })}
          />
          <span>Auto-exit dangerous sites</span>
        </label>
        <p className="sp-setting-desc">
          Automatically navigate away from high/critical threats.
        </p>
      </div>
    </div>
  );
};

export default Settings;
