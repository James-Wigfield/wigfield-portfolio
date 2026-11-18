/* Which kind of AR this device has (the spot page's "See it in your space").

     'quicklook'  iPhone / iPad Safari: AR Quick Look with a USDZ (no WebXR there)
     'webxr'      Android Chrome (ARCore): WebXR immersive-ar inside the viewer
     'none'       anything else (a desktop gets a QR code to open it on a phone)

   Quick Look is detected the way Apple documents it (an <a> whose relList
   supports "ar"), with the user agent as the fallback: an in-app browser on iOS
   can lack the relList hook, and the headless check emulates an iPhone UA. */

export function isAppleMobile(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return true;
  // iPadOS asks for the desktop site: a "Macintosh" with a touch screen.
  return /\bMacintosh\b/.test(ua) && (nav.maxTouchPoints || 0) > 1;
}

export function quickLookSupported() {
  try {
    const a = document.createElement('a');
    if (a.relList?.supports?.('ar')) return true;
  } catch {
    /* fall through to the UA */
  }
  return isAppleMobile();
}

export async function webXrArSupported() {
  try {
    return Boolean(await navigator.xr?.isSessionSupported?.('immersive-ar'));
  } catch {
    return false;
  }
}

/** 'quicklook' | 'webxr' | 'none' */
export async function arKind() {
  if (quickLookSupported()) return 'quicklook';
  if (await webXrArSupported()) return 'webxr';
  return 'none';
}

/** A phone or tablet (a coarse pointer): no QR code there, it IS the phone. */
export const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
