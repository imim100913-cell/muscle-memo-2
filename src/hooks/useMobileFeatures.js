import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook managing innovative mobile capabilities:
 * 1. Screen Wake Lock API (prevents screen dimming/locking during active workouts & timers)
 * 2. PWA Service Worker registration & instant version update detection
 * 3. Native PWA Home Screen Installation prompt (Android/Chrome + iOS detection)
 */
export function useMobileFeatures({ autoWakeLock = false } = {}) {
  // --- 1. Screen Wake Lock State ---
  const wakeLockSentinelRef = useRef(null);
  const [wakeLockSupported] = useState(
    () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
  );
  const [isWakeLockEnabled, setIsWakeLockEnabled] = useState(() => {
    return localStorage.getItem('muscle-memo-wakelock') !== 'off';
  });
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const requestWakeLock = useCallback(async () => {
    await Promise.resolve();
    if (!wakeLockSupported || !isWakeLockEnabled) return;
    if (document.visibilityState !== 'visible') return;
    if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
      setWakeLockActive(true);
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, [wakeLockSupported, isWakeLockEnabled]);

  const releaseWakeLock = useCallback(async () => {
    await Promise.resolve();
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch {
        // Ignore release errors
      }
      wakeLockSentinelRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  const toggleWakeLock = useCallback(() => {
    setIsWakeLockEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('muscle-memo-wakelock', next ? 'on' : 'off');
      if (!next) {
        releaseWakeLock();
      }
      return next;
    });
  }, [releaseWakeLock]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (autoWakeLock && isWakeLockEnabled) {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      releaseWakeLock();
    };
  }, [autoWakeLock, isWakeLockEnabled, requestWakeLock, releaseWakeLock]);

  // Re-acquire Wake Lock when returning to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && autoWakeLock && isWakeLockEnabled) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoWakeLock, isWakeLockEnabled, requestWakeLock]);

  // --- 2. PWA Installation & Standalone State ---
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });
  const [isIos] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPwa = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  // --- 3. Service Worker & Instant Update Detection ---
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const swRegistrationRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        swRegistrationRef.current = reg;
        if (reg.waiting) {
          setUpdateAvailable(true);
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // Ignore SW registration error in restricted environments
      });

    // Proactively check for SW updates whenever user focuses the app
    const checkSwUpdate = () => {
      if (swRegistrationRef.current) {
        swRegistrationRef.current.update().catch(() => {});
      }
    };
    window.addEventListener('focus', checkSwUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('focus', checkSwUpdate);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const reg = swRegistrationRef.current;
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, []);

  const checkForLatestVersion = useCallback(async () => {
    const reg = swRegistrationRef.current;
    if (reg) {
      try {
        await reg.update();
        if (reg.waiting) {
          setUpdateAvailable(true);
          return 'update_found';
        }
      } catch {
        // Ignore
      }
    }
    return 'up_to_date';
  }, []);

  return {
    wakeLockSupported,
    wakeLockActive,
    isWakeLockEnabled,
    toggleWakeLock,
    canInstallPwa: !!deferredPrompt,
    isStandalone,
    isIos,
    installPwa,
    updateAvailable,
    applyUpdate,
    checkForLatestVersion
  };
}
