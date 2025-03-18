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
    /**
     * The wake lock sentinel that controls the screen wake lock.
     * @type {WakeLockSentinel|null}
     * @private
     */
    private _wakeLock;
    /**
     * Attempts to acquire a screen wake lock.
     * If the Wake Lock API is not supported, a warning is logged.
     *
     * @returns {Promise<void>}
     */
    acquire(): Promise<void>;
    /**
     * Releases the screen wake lock if it is active.
     *
     * @returns {Promise<void>}
     */
    release(): Promise<void>;
    /**
     * Indicates whether the wake lock is currently active.
     *
     * @returns {boolean} True if the wake lock is active, false otherwise.
     */
    isActive(): boolean;
}
