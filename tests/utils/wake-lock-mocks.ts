/**
 * Wake Lock Manager Mock Utilities
 *
 * Provides reusable mock utilities for testing wake lock functionality
 * across different test files to eliminate repetitive mock setup.
 */

export type WakeLockMocks = {
  acquire: jest.Mock<Promise<void>, []>;
  release: jest.Mock<Promise<void>, []>;
  isActive: jest.Mock<boolean, []>;
};

/**
 * Creates a complete set of wake lock manager mocks
 * @returns Object containing all wake lock manager mock methods
 */
export function createWakeLockMocks(): WakeLockMocks {
  return {
    acquire: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    release: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    isActive: jest.fn<boolean, []>().mockReturnValue(true),
  };
}

/**
 * Creates mock for acquire method only (when testing start scenarios)
 * @returns Mock function for acquire method
 */
export function createAcquireMock(): jest.Mock<Promise<void>, []> {
  return jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
}

/**
 * Creates mock for release method only (when testing pause/end scenarios)
 * @returns Mock function for release method
 */
export function createReleaseMock(): jest.Mock<Promise<void>, []> {
  return jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
}

/**
 * Creates mock for isActive method with configurable return value
 * @param isActive - Whether the wake lock should appear active
 * @returns Mock function for isActive method
 */
export function createIsActiveMock(isActive = true): jest.Mock<boolean, []> {
  return jest.fn<boolean, []>().mockReturnValue(isActive);
}

/**
 * Creates wake lock mocks that simulate error conditions
 * @returns Object containing error-throwing wake lock mocks
 */
export function createWakeLockErrorMocks(): WakeLockMocks {
  return {
    acquire: jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('Wake lock failed')),
    release: jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('Release failed')),
    isActive: jest.fn<boolean, []>().mockReturnValue(false),
  };
}

/**
 * Applies wake lock mocks to a voice agent instance
 * @param voiceAgent - The voice agent instance to apply mocks to
 * @param mocks - The wake lock mocks to apply
 */
export function applyWakeLockMocks(
  voiceAgent: any,
  mocks: WakeLockMocks
): void {
  voiceAgent.wakeLockManager.acquire = mocks.acquire;
  voiceAgent.wakeLockManager.release = mocks.release;
  voiceAgent.wakeLockManager.isActive = mocks.isActive;
}
