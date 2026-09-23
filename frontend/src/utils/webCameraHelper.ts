import { Platform } from 'react-native';

/**
 * Resizes and compresses an image File or Blob on the client using HTML5 Canvas.
 * Drastically reduces memory usage (from 25MB down to ~300KB) to prevent
 * mobile browsers (Chrome / Android LMK) from crashing due to low memory.
 */
export async function compressImageFile(file: File | Blob, maxDim = 1600, quality = 0.82): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Canvas compression only available in browser'));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Scale down if dimensions exceed maxDim while maintaining aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback to FileReader if canvas context is unavailable
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Triggers mobile device camera or photo picker via standard HTML Media Capture.
 * Compresses the image on-the-fly to prevent low-memory browser crashes.
 */
export function captureFromDeviceCamera(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 'environment' requests the rear / back package inspection camera
    input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    let resolved = false;

    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };

    input.onchange = async (e: any) => {
      resolved = true;
      const file = e.target?.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      try {
        const compressedUri = await compressImageFile(file, 1600, 0.82);
        cleanup();
        resolve(compressedUri);
      } catch (err) {
        console.warn('[webCameraHelper] Canvas compression failed, falling back to FileReader:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          cleanup();
          const result = event.target?.result;
          resolve(typeof result === 'string' ? result : null);
        };
        reader.onerror = () => {
          cleanup();
          resolve(null);
        };
        reader.readAsDataURL(file);
      }
    };

    // If user opens the camera and cancels / backs out without snapping a photo
    const handleWindowFocus = () => {
      setTimeout(() => {
        if (!resolved && (!input.files || input.files.length === 0)) {
          cleanup();
          resolve(null);
        }
      }, 2000);
      window.removeEventListener('focus', handleWindowFocus);
    };
    window.addEventListener('focus', handleWindowFocus, { once: true });

    try {
      input.click();
    } catch (err) {
      console.warn('[webCameraHelper] Failed to trigger file input click:', err);
      cleanup();
      resolve(null);
    }
  });
}
