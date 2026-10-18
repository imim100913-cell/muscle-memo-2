/**
 * Anti-Gravity 2.0: Synthetic Audio, Haptic Vibration & Native Notification Engine
 * Synthesizes retro beeps using Web Audio API, triggers mobile haptics via Vibration API,
 * and dispatches native OS notifications when interval timers complete.
 */

let audioCtx = null;

/**
 * Initializes and resumes the AudioContext to comply with browser autoplay policies.
 */
export function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.error("Failed to unlock Web Audio API:", e);
  }
}

/**
 * Triggers smartphone haptic feedback via Web Vibration API.
 * Works even in silent audio mode (unless haptics are explicitly disabled).
 *
 * @param {'light'|'tick'|'success'|'pr'|'alarm'|number|number[]} typeOrPattern
 */
export function triggerHaptic(typeOrPattern = 'light') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const hapticsPref = localStorage.getItem('muscle-memo-haptics') || 'on';
  if (hapticsPref === 'off') return;

  const patterns = {
    light: 15,
    tick: 35,
    success: [50, 40, 100],
    pr: [80, 50, 80, 50, 180],
    alarm: [200, 100, 200, 100, 350]
  };

  const pattern = patterns[typeOrPattern] || typeOrPattern;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore vibration errors on unsupported browsers
  }
}

/**
 * Requests browser / PWA notification permission for background interval alerts.
 * @returns {Promise<string>} Permission state ('granted' | 'denied' | 'default' | 'unsupported')
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || 'default';
  }
}

/**
 * Sends a native OS / PWA notification (ideal when phone screen is locked or user is in another app).
 * @param {string} title
 * @param {string} body
 */
export async function sendTimerNotification(
  title = '⏱️ インターバル終了！',
  body = '休息が完了しました。次のセットに入りましょう！'
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: './icon.svg',
          badge: './icon.svg',
          tag: 'muscle-memo-timer',
          renotify: true,
          vibrate: [200, 100, 200, 100, 350]
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: './icon.svg',
      tag: 'muscle-memo-timer'
    });
  } catch (e) {
    console.warn('Notification dispatch failed:', e);
  }
}

/**
 * Synthesizes a digital beep notification.
 * Plays via speaker/earphones depending on device connection.
 * Respects the silent mode toggle while still triggering haptics on mobile.
 *
 * @param {number} frequency - Beep pitch in Hz.
 * @param {number} durationMs - Duration in milliseconds.
 */
export function playBeep(frequency = 800, durationMs = 150) {
  // Always trigger corresponding haptic pulse on mobile devices
  if (durationMs >= 500) {
    triggerHaptic('alarm');
  } else if (frequency >= 800) {
    triggerHaptic('tick');
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const soundMode = localStorage.getItem('muscle-memo-sound-mode') || 'sound';
  if (soundMode === 'silent') return; // Vibrate/Silent mode selected by user

  try {
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    // Dynamic volume control and quick fade-out envelope to avoid crackling sound
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch (e) {
    console.error("Audio synthesis failed:", e);
  }
}
