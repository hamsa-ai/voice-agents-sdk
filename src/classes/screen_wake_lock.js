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
export default class ScreenWakeLock {
    constructor() {
      /**
       * The wake lock sentinel that controls the screen wake lock.
       * @type {WakeLockSentinel|null}
       * @private
       */
      this._wakeLock = null;
    }
  
    /**
     * Attempts to acquire a screen wake lock.
     * If the Wake Lock API is not supported, a warning is logged.
     *
     * @returns {Promise<void>}
     */
    async acquire() {
      if ('wakeLock' in navigator) {
        try {
          this._wakeLock = await navigator.wakeLock.request('screen');
          this._wakeLock.addEventListener('release', () => {
            this._wakeLock = null;
          });
        } catch (err) {
          console.error(
            `Failed to acquire screen wake lock: ${err.name}, ${err.message}`
          );
        }
      } else {
        console.warn('Screen Wake Lock API is not supported in this browser.');
      }
    }
  
    /**
     * Releases the screen wake lock if it is active.
     *
     * @returns {Promise<void>}
     */
    async release() {
      if (this._wakeLock !== null) {
        try {
          await this._wakeLock.release();
          this._wakeLock = null;
        } catch (err) {
          console.error(
            `Error releasing screen wake lock: ${err.name}, ${err.message}`
          );
        }
      }
    }
  
    /**
     * Indicates whether the wake lock is currently active.
     *
     * @returns {boolean} True if the wake lock is active, false otherwise.
     */
    isActive() {
      return this._wakeLock !== null;
    }
  }
  