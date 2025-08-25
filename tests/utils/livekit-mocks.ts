/**
 * LiveKit Mock Utilities
 *
 * Provides reusable mock utilities for testing LiveKit functionality
 * including Room mocks, event handler extraction, and common patterns.
 */

import { Track } from 'livekit-client';

export type MockRoom = {
  connect: jest.Mock;
  disconnect: jest.Mock;
  prepareConnection: jest.Mock;
  registerRpcMethod: jest.Mock;
  localParticipant: {
    setMicrophoneEnabled: jest.Mock;
    getTrackPublication: jest.Mock;
  };
  on: jest.Mock;
  name: string;
};

export type MockTrack = {
  kind: string;
  attach?: jest.Mock;
  detach?: jest.Mock;
  mediaStreamTrack?: any;
};

/**
 * Creates a complete mock Room instance with all necessary methods
 * @returns Mock room object with all required LiveKit Room methods
 */
export function createMockRoom(): MockRoom {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    prepareConnection: jest.fn(),
    registerRpcMethod: jest.fn(),
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      getTrackPublication: jest.fn().mockReturnValue({
        track: {
          mediaStreamTrack: new MediaStreamTrack(),
        },
      }),
    },
    on: jest.fn().mockReturnThis(),
    name: 'test-room',
  };
}

/**
 * Extracts event handler from mock room's on() calls
 * @param mockRoom - The mock room instance
 * @param eventType - The event type to find (e.g., RoomEvent.Connected)
 * @returns The event handler function or undefined if not found
 */
export function extractEventHandler(
  mockRoom: MockRoom,
  eventType: string
): ((...args: any[]) => void) | undefined {
  const mockCall = mockRoom.on.mock.calls.find(
    (callArgs) => callArgs[0] === eventType
  );
  return mockCall ? mockCall[1] : undefined;
}

/**
 * Creates a mock audio track for testing track subscription scenarios
 * @returns Mock audio track object
 */
export function createMockAudioTrack(): MockTrack {
  return {
    kind: Track.Kind.Audio,
    attach: jest.fn().mockReturnValue(new HTMLAudioElement()),
    detach: jest.fn().mockReturnValue([new HTMLAudioElement()]),
    mediaStreamTrack: new MediaStreamTrack(),
  };
}

/**
 * Creates a mock video track for testing track subscription scenarios
 * @returns Mock video track object
 */
export function createMockVideoTrack(): MockTrack {
  return {
    kind: Track.Kind.Video,
    attach: jest.fn().mockReturnValue(document.createElement('video')),
    detach: jest.fn().mockReturnValue([document.createElement('video')]),
    mediaStreamTrack: new MediaStreamTrack(),
  };
}

/**
 * Creates mock data payload for DataReceived events
 * @param event - The event type (e.g., 'transcription', 'answer')
 * @param content - The content data
 * @returns Encoded Uint8Array payload
 */
export function createMockDataPayload(event: string, content: any): Uint8Array {
  const payload = JSON.stringify({ event, content });
  return new TextEncoder().encode(payload);
}

/**
 * Creates mock data payload with custom data structure
 * @param event - The event type
 * @param data - The data object
 * @returns Encoded Uint8Array payload
 */
export function createMockInfoPayload(event: string, data: any): Uint8Array {
  const payload = JSON.stringify({ event, data });
  return new TextEncoder().encode(payload);
}

/**
 * Simulates triggering a room event on the mock room
 * @param mockRoom - The mock room instance
 * @param eventType - The event type to trigger
 * @param args - Arguments to pass to the event handler
 */
export async function triggerRoomEvent(
  mockRoom: MockRoom,
  eventType: string,
  ...args: any[]
): Promise<void> {
  const handler = extractEventHandler(mockRoom, eventType);
  if (handler) {
    await handler(...args);
  }
}

/**
 * Creates a mock room with error conditions for testing error scenarios
 * @returns Mock room object that throws errors on operations
 */
export function createMockRoomWithErrors(): MockRoom {
  return {
    connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
    disconnect: jest.fn().mockRejectedValue(new Error('Disconnection failed')),
    prepareConnection: jest.fn().mockImplementation(() => {
      throw new Error('Preparation failed');
    }),
    registerRpcMethod: jest.fn().mockImplementation(() => {
      throw new Error('RPC registration failed');
    }),
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockImplementation(() => {
        throw new Error('Microphone error');
      }),
      getTrackPublication: jest.fn().mockReturnValue(null),
    },
    on: jest.fn().mockReturnThis(),
    name: 'error-room',
  };
}

/**
 * Creates a set of common test tools for RPC testing
 * @returns Array of mock tool objects
 */
export function createMockTools() {
  return [
    {
      function_name: 'testTool',
      fn: jest.fn().mockResolvedValue('test result'),
    },
    {
      function_name: 'asyncTool',
      fn: jest.fn().mockResolvedValue({ success: true, data: 'async result' }),
    },
  ];
}

/**
 * Constants for test volume values to maintain consistency across tests
 */
export const TEST_VOLUMES = {
  DEFAULT: 1.0,
  MIN: 0.0,
  HALF: 0.5,
  CUSTOM: 0.7,
  HIGHER: 0.8,
  ABOVE_MAX: 1.5,
  BELOW_MIN: -0.5,
} as const;
