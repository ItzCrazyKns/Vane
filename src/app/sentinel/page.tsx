import { Shield, ShieldCheck, ShieldAlert, Download, ExternalLink } from 'lucide-react';

const features = [
  {
    title: 'Real-time Threat Detection',
    description:
      'Automatically analyzes every page you visit using heuristic pattern matching and a local AI model (Gemma 3n via WebLLM).',
    icon: ShieldAlert,
  },
  {
    title: 'Privacy-First Architecture',
    description:
      'All analysis runs locally in your browser. No data is sent to external servers. Your browsing history stays private.',
    icon: ShieldCheck,
  },
  {
    title: 'Evidence Capture & Reports',
    description:
      'Screenshots, DOM snapshots, and structured JSON reports are saved locally for each detected threat.',
    icon: Shield,
  },
];

const SentinelPage = () => {
  return (
    <div className="flex flex-col max-w-screen-lg lg:mx-auto mx-4 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Shield size={32} className="text-[#7c3aed]" />
        <h1 className="text-black/70 dark:text-white/70 text-3xl font-medium">
          Sentinel Mode
        </h1>
      </div>
      <p className="text-black/50 dark:text-white/50 text-sm mb-8">
        Browser security extension powered by local AI — protects you from
        phishing, scams, and malware.
      </p>

      {/* Feature Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 p-5 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary"
          >
            <feature.icon size={24} className="text-[#7c3aed]" />
            <h3 className="text-black/70 dark:text-white/70 font-medium text-sm">
              {feature.title}
            </h3>
            <p className="text-black/50 dark:text-white/50 text-xs leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <h2 className="text-black/70 dark:text-white/70 text-lg font-medium mb-4">
        How It Works
      </h2>
      <ol className="list-decimal list-inside space-y-2 text-black/60 dark:text-white/60 text-sm mb-10">
        <li>
          Install the Sentinel browser extension from the{' '}
          <code className="text-xs bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded">
            sentinel-extension/
          </code>{' '}
          directory.
        </li>
        <li>
          The extension loads a local Gemma 3n model via WebLLM (no cloud
          required).
        </li>
        <li>
          Every page you visit is scanned using heuristic rules and AI analysis.
        </li>
        <li>
          If a threat is detected, a warning overlay appears with an option to
          exit immediately.
        </li>
        <li>
          Evidence (screenshots, DOM snapshots, reports) is saved in the
          extension sidepanel.
        </li>
      </ol>

      {/* Install Instructions */}
      <h2 className="text-black/70 dark:text-white/70 text-lg font-medium mb-4">
        Installation
      </h2>
      <div className="p-5 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary text-sm text-black/60 dark:text-white/60 space-y-3">
        <p className="font-medium text-black/70 dark:text-white/70">
          Developer Install (Chrome)
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs">
          <li>
            Build the extension:{' '}
            <code className="bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded">
              cd sentinel-extension && npm install && npm run build
            </code>
          </li>
          <li>
            Open{' '}
            <code className="bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded">
              chrome://extensions
            </code>{' '}
            and enable Developer Mode.
          </li>
          <li>
            Click &quot;Load unpacked&quot; and select the{' '}
            <code className="bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded">
              sentinel-extension/dist
            </code>{' '}
            folder.
          </li>
          <li>
            Click the Sentinel icon in the toolbar to open the sidepanel.
          </li>
        </ol>
      </div>
    </div>
  );
};

export default SentinelPage;
