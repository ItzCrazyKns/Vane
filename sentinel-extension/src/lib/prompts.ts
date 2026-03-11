/**
 * System prompt for the local security analyst LLM (Gemma 3n).
 *
 * The model receives page metadata extracted by the content script
 * and must return a structured JSON verdict.
 */
export const SECURITY_ANALYST_SYSTEM_PROMPT = `You are a cybersecurity analyst AI specialized in detecting web-based threats. Your job is to protect users—especially those who are not tech-savvy—from phishing, scams, and malware.

You will receive structured metadata about a webpage including its URL, DOM structure, forms, scripts, iframes, and any suspicious text patterns already detected.

Analyze the metadata carefully and identify:
- **Phishing**: Fake login pages, credential harvesting, lookalike domains impersonating known brands.
- **Scams**: Fake offers, lottery/prize claims, tech-support scams, urgency-driven social engineering.
- **Malware**: Obfuscated scripts, hidden iframes loading external content, drive-by download indicators.
- **Suspicious**: Unusual patterns that don't clearly fit the above but warrant caution.

Be conservative: only flag a page as a threat if there is clear evidence. Avoid false positives on legitimate sites. Multiple weak signals combined may constitute a real threat.

You MUST respond with ONLY valid JSON (no markdown, no explanation outside the JSON). Use this exact structure:

{
  "isThreat": true or false,
  "level": "low" | "medium" | "high" | "critical",
  "type": "phishing" | "scam" | "malware" | "suspicious" | "safe",
  "confidence": 0.0 to 1.0,
  "summary": "One clear sentence explaining the verdict",
  "details": ["Specific indicator 1", "Specific indicator 2"]
}

Guidelines for threat levels:
- "low": Minor concerns, probably safe but worth noting.
- "medium": Multiple suspicious signals, user should be cautious.
- "high": Strong indicators of a threat, user should leave.
- "critical": Clear and obvious threat (e.g., known phishing pattern + credential form).

If the page appears safe, return isThreat: false with type: "safe".`;

/**
 * Builds the user-facing analysis prompt from page metadata.
 * This is sent as the "user" message alongside the system prompt.
 */
export function buildAnalysisPrompt(metadata: {
  url: string;
  title: string;
  domain: string;
  domStructure: {
    totalElements: number;
    formCount: number;
    inputFields: Array<{ isPassword: boolean; isHidden: boolean; type: string }>;
    suspiciousPatterns: string[];
  };
  forms: Array<{
    action: string;
    isExternal: boolean;
    hasPasswordField: boolean;
    inputCount: number;
  }>;
  externalLinks: Array<{ href: string }>;
  scripts: Array<{ src: string; isExternal: boolean; hasObfuscation: boolean }>;
  iframes: Array<{ src: string; isHidden: boolean; isExternal: boolean }>;
}): string {
  const passwordFields = metadata.domStructure.inputFields.filter(
    (f) => f.isPassword,
  );
  const hiddenInputs = metadata.domStructure.inputFields.filter(
    (f) => f.isHidden,
  );
  const obfuscatedScripts = metadata.scripts.filter((s) => s.hasObfuscation);
  const hiddenIframes = metadata.iframes.filter((i) => i.isHidden);
  const externalForms = metadata.forms.filter((f) => f.isExternal);

  return `Analyze this webpage for security threats:

URL: ${metadata.url}
Page Title: ${metadata.title}
Domain: ${metadata.domain}
Protocol: ${metadata.url.startsWith('https') ? 'HTTPS' : 'HTTP'}

DOM Structure:
- Total elements: ${metadata.domStructure.totalElements}
- Forms: ${metadata.domStructure.formCount}
- Password fields: ${passwordFields.length}
- Hidden input fields: ${hiddenInputs.length}

Suspicious Text Patterns Already Detected:
${metadata.domStructure.suspiciousPatterns.length > 0 ? metadata.domStructure.suspiciousPatterns.map((p) => `- ${p}`).join('\n') : '- None'}

Forms Analysis:
${
  metadata.forms.length > 0
    ? metadata.forms
        .map(
          (f) =>
            `- Action: ${f.action || '[same page]'}, External: ${f.isExternal}, Password: ${f.hasPasswordField}, Inputs: ${f.inputCount}`,
        )
        .join('\n')
    : '- No forms found'
}

External Forms (submitting data off-site): ${externalForms.length}
External Links: ${metadata.externalLinks.length}

Iframes: ${metadata.iframes.length} total, ${hiddenIframes.length} hidden
${
  hiddenIframes.length > 0
    ? hiddenIframes.map((i) => `- Hidden iframe src: ${i.src}`).join('\n')
    : ''
}

Scripts: ${metadata.scripts.length} total, ${obfuscatedScripts.length} with obfuscation patterns
${
  obfuscatedScripts.length > 0
    ? obfuscatedScripts.map((s) => `- Obfuscated: ${s.src}`).join('\n')
    : ''
}

Provide your threat assessment as JSON.`;
}
