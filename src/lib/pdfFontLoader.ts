let cachedFont: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function loadCJKFont(): Promise<string | null> {
  if (cachedFont) return cachedFont;

  try {
    const response = await fetch('/fonts/NotoSansSC-Regular.ttf');
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    cachedFont = arrayBufferToBase64(buffer);
    return cachedFont;
  } catch {
    return null;
  }
}

export function registerCJKFont(
  doc: import('jspdf').jsPDF,
  fontBase64: string,
) {
  doc.addFileToVFS('NotoSansSC-Regular.ttf', fontBase64);
  doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');
}
