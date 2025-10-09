/**
 * Manages a Screen Wake Lock using the Wake Lock API.
 *
 * This class encapsulates the logic for requesting and releasing a screen
 * wake lock to prevent the device from sleeping during an active call.
 *
 * Usage:
 *   import ScreenWakeLock from './ScreenWakeLock';
 *   const wakeLockManager = new ScreenWakeLock();
 *
 *   To acquire the wake lock:
 *   await wakeLockManager.acquire();
 *
 *   To release the wake lock:
 *   await wakeLockManager.release();
 *
 *   Check if the wake lock is active:
 *   console.log(wakeLockManager.isActive());
 */

// Type definitions for Screen Wake Lock API
type WakeLockSentinel = EventTarget & {
  readonly type: 'screen';
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
};

type WakeLock = {
  request(type: 'screen'): Promise<WakeLockSentinel>;
};

// Type guard to check if navigator has wakeLock
function hasWakeLock(
  nav: Navigator
): nav is Navigator & { wakeLock: WakeLock } {
  return (
    'wakeLock' in nav &&
    typeof (nav as { wakeLock?: unknown }).wakeLock === 'object'
  );
}

export default class ScreenWakeLock {
  /**
   * The wake lock sentinel that controls the screen wake lock.
   * @private
   */
  private _wakeLock: WakeLockSentinel | null = null;

  constructor() {
    this._wakeLock = null;
  }

  /**
   * Attempts to acquire a screen wake lock.
   * If the Wake Lock API is not supported, a warning is logged.
   *
   * @returns Promise<void>
   */
  async acquire(): Promise<void> {
    if (hasWakeLock(navigator)) {
      try {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => {
          this._wakeLock = null;
        });
      } catch {
        // Ignore wake lock request errors
      }
    } else {
      // Wake lock API not supported
    }
  }

  /**
   * Releases the screen wake lock if it is active.
   *
   * @returns Promise<void>
   */
  async release(): Promise<void> {
    if (this._wakeLock !== null) {
      try {
        await this._wakeLock.release();
        this._wakeLock = null;
      } catch {
        // Ignore wake lock release errors
      }
    }
  }

  /**
   * Indicates whether the wake lock is currently active.
   *
   * @returns True if the wake lock is active, false otherwise.
   */
  isActive(): boolean {
    return this._wakeLock !== null;
  }
}
