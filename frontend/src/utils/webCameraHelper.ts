import { Platform } from 'react-native';

/**
 * Triggers the native mobile device camera via standard HTML Media Capture.
 * Key advantage: Supported over plain HTTP across mobile browsers (Android Chrome, iOS Safari).
 * Launches the device's native camera app and returns the captured image as a Data URI.
 */
export function captureFromDeviceCamera(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 'environment' tells mobile browsers to invoke the rear / back package inspection camera
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

    input.onchange = (e: any) => {
      resolved = true;
      const file = e.target?.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        cleanup();
        const result = event.target?.result;
        resolve(typeof result === 'string' ? result : null);
      };
      reader.onerror = (err) => {
        console.warn('[webCameraHelper] FileReader error:', err);
        cleanup();
        resolve(null);
      };
      reader.readAsDataURL(file);
    };

    // If user opens the camera and cancels / backs out without snapping a photo
    const handleWindowFocus = () => {
      setTimeout(() => {
        if (!resolved && (!input.files || input.files.length === 0)) {
          cleanup();
          resolve(null);
        }
      }, 1500);
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
