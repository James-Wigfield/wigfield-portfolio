/* One GPS fix. Rejects with an Error whose `.code` is
   insecure | unsupported | denied | timeout | unavailable. */

function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

export function locate({ timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(fail('insecure')); // geolocation needs https (or localhost)
      return;
    }
    if (!navigator.geolocation) {
      reject(fail('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(fail(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}
