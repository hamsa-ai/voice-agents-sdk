/**
 * Test Constants
 *
 * Centralized constants used across multiple test files to ensure consistency
 * and eliminate magic numbers/strings throughout the test suite.
 */

// Volume constants
export const VOLUMES = {
  DEFAULT: 1.0,
  MIN: 0.0,
  HALF: 0.5,
  CUSTOM: 0.7,
  HIGHER: 0.8,
  ABOVE_MAX: 1.5,
  BELOW_MIN: -0.5,
  SIX_TENTHS: 0.6,
  THREE_TENTHS: 0.3,
} as const;

// Timing constants
export const TIMING = {
  DELAY_MS: 100,
  VARIANCE_MS: 90,
  TIMEOUT_MS: 5000,
} as const;

// Mock API configuration
export const MOCK_CONFIG = {
  API_KEY: 'test-api-key',
  API_URL: 'https://test-api.com',
  LIVEKIT_URL: 'wss://test.livekit.com',
  ACCESS_TOKEN: 'test-token',
  JOB_ID: 'mock-job-id',
  LIVEKIT_TOKEN: 'mock-livekit-token',
  ROOM_NAME: 'test-room',
} as const;

// Common agent configurations
export const AGENT_CONFIGS = {
  DEFAULT: {
    agentId: 'test-agent',
    params: {},
    voiceEnablement: true,
    tools: [] as any[],
  },
  WITH_PARAMS: {
    agentId: 'test-agent',
    params: { name: 'Test User', age: 30 },
    voiceEnablement: true,
    tools: [] as any[],
  },
  WITH_TOOLS: {
    agentId: 'test-agent',
    params: {},
    voiceEnablement: true,
    tools: [
      {
        function_name: 'testTool',
        description: 'A test tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'First parameter',
          },
        ],
        required: ['param1'],
        fn: jest.fn().mockResolvedValue('test result'),
      },
    ] as any[],
  },
};

// Event names used in tests
export const EVENTS = {
  // Voice Agent Events
  CALL_STARTED: 'callStarted',
  CALL_ENDED: 'callEnded',
  CALL_PAUSED: 'callPaused',
  CALL_RESUMED: 'callResumed',
  START: 'start',
  SPEAKING: 'speaking',
  LISTENING: 'listening',
  TRANSCRIPTION_RECEIVED: 'transcriptionReceived',
  ANSWER_RECEIVED: 'answerReceived',
  INFO: 'info',
  ERROR: 'error',
  CLOSED: 'closed',
  REMOTE_AUDIO_STREAM_AVAILABLE: 'remoteAudioStreamAvailable',
  LOCAL_AUDIO_STREAM_AVAILABLE: 'localAudioStreamAvailable',

  // LiveKit Room Events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  TRACK_SUBSCRIBED: 'trackSubscribed',
  TRACK_UNSUBSCRIBED: 'trackUnsubscribed',
  DATA_RECEIVED: 'dataReceived',
} as const;

// Common test data structures
export const TEST_DATA = {
  TRANSCRIPTION: 'Hello world',
  ANSWER: 'AI response',
  INFO_DATA: { status: 'processing', data: { progress: 50 } },
  USER_DATA: { name: 'John Doe', age: 30 },
  JOB_DETAILS: {
    status: 'COMPLETED',
    duration: 120,
    transcript: 'Hello world',
  },
  ERROR_MESSAGE: 'Test error message',
} as const;

// RPC test data
export const RPC_DATA = {
  VALID_PAYLOAD: '{"param1": "value1", "param2": "value2"}',
  INVALID_PAYLOAD: 'invalid json',
  EMPTY_PAYLOAD: '',
  RESULT: { success: true, data: 'test result' },
  ERROR_RESULT: { error: 'Tool execution failed' },
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
