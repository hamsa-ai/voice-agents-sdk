/**
 * Shared Setup for LiveKit Manager Tests
 *
 * Common setup and configuration used across all LiveKit Manager test modules
 * to ensure consistency and reduce duplication.
 */

import { Room, RoomEvent } from 'livekit-client';
import LiveKitManager from '../../src/classes/livekit-manager';
import { createMockRoom, createMockTools } from '../utils/livekit-mocks';
import { MOCK_CONFIG } from '../utils/test-constants';

export type TestContext = {
  liveKitManager: LiveKitManager;
  mockRoom: any;
  mockUrl: string;
  mockToken: string;
  mockTools: any[];
};

/**
 * Creates a fresh test context for each test
 * @returns Test context with initialized LiveKitManager and mocks
 */
export function createTestContext(): TestContext {
  const mockRoom = createMockRoom();
  const mockUrl = MOCK_CONFIG.LIVEKIT_URL;
  const mockToken = MOCK_CONFIG.ACCESS_TOKEN;
  const mockTools = createMockTools();

  // Mock Room constructor to return our mock
  (Room as jest.MockedClass<typeof Room>).mockImplementation(
    () => mockRoom as unknown as Room
  );

  const liveKitManager = new LiveKitManager(mockUrl, mockToken, mockTools);

  return {
    liveKitManager,
    mockRoom,
    mockUrl,
    mockToken,
    mockTools,
  };
}

/**
 * Common beforeEach setup for all LiveKit Manager tests
 * @returns Test context for the current test
 */
export function setupTest(): TestContext {
  jest.clearAllMocks();
  return createTestContext();
}

/**
 * Verifies that room event listeners are properly set up
 * @param mockRoom - The mock room to verify
 */
export function verifyRoomEventListeners(mockRoom: any): void {
  const expectedCalls = [
    RoomEvent.Connected,
    RoomEvent.Disconnected,
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.DataReceived,
  ];

  for (const eventType of expectedCalls) {
    // biome-ignore lint/suspicious/noMisplacedAssertion: This is a test utility function that needs to perform assertions
    expect(mockRoom.on).toHaveBeenCalledWith(eventType, expect.any(Function));
  }
}

/**
 * Verifies Room constructor was called with correct configuration
 */
export function verifyRoomConfiguration(): void {
  const expectedConfig = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 1280, height: 720 },
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  };

  // biome-ignore lint/suspicious/noMisplacedAssertion: This is a test utility function that needs to perform assertions
  expect(Room).toHaveBeenCalledWith(expectedConfig);
}

// Re-export commonly used constants and utilities
// biome-ignore lint/performance/noBarrelFile: Legitimate pattern for shared test utilities
export { RoomEvent, Track } from 'livekit-client';
export {
  createMockAudioTrack,
  createMockDataPayload,
  createMockInfoPayload,
  createMockVideoTrack,
  extractEventHandler,
  triggerRoomEvent,
} from '../utils/livekit-mocks';
export { MOCK_CONFIG, TEST_DATA } from '../utils/test-constants';
