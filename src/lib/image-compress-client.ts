/**
 * Client-side image compression (browser only).
 * Used by chat, news, and any user upload flows.
 */

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mime?: string;
};

export async function compressImageFile(
  file: File,
  opts: CompressOptions = {}
): Promise<{ file: File; compressed: boolean; width: number; height: number }> {
  if (!file.type.startsWith('image/')) {
    return { file, compressed: false, width: 0, height: 0 };
  }
  // Skip tiny files already under ~200KB unless huge dimensions
  const maxW = opts.maxWidth ?? 1280;
  const maxH = opts.maxHeight ?? 1280;
  const quality = opts.quality ?? 0.78;
  const mime = opts.mime ?? 'image/jpeg';

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { file, compressed: false, width: bitmap.width, height: bitmap.height };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality)
    );
    if (!blob) {
      return { file, compressed: false, width: w, height: h };
    }
    // Only replace if smaller or dimensions reduced
    if (blob.size >= file.size && scale >= 0.99) {
      return { file, compressed: false, width: w, height: h };
    }
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const out = new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
    return { file: out, compressed: true, width: w, height: h };
  } catch {
    return { file, compressed: false, width: 0, height: 0 };
  }
}

/** Data URL compress (legacy avatar-style) */
export async function compressImageToDataUrl(
  file: File,
  maxW = 512,
  quality = 0.8
): Promise<string> {
  const { file: out } = await compressImageFile(file, {
    maxWidth: maxW,
    maxHeight: maxW,
    quality,
    mime: 'image/jpeg',
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(out);
  });
}
