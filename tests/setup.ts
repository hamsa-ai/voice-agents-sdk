// TypeScript type declarations for global mocks
type JestMock = {
  (...args: unknown[]): unknown;
  mockReturnValue(value: unknown): JestMock;
  mockResolvedValue(value: unknown): JestMock;
  mockRejectedValue(value: unknown): JestMock;
  mockResolvedValueOnce(value: unknown): JestMock;
  mockImplementation(fn: (...args: unknown[]) => unknown): JestMock;
  mock: {
    calls: unknown[][];
    results: unknown[];
  };
};

// Enhanced fetch mock type
type FetchMock = {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  mockResolvedValue(value: unknown): FetchMock;
  mockRejectedValue(value: unknown): FetchMock;
  mockResolvedValueOnce(value: unknown): FetchMock;
  mockImplementation(fn: (...args: unknown[]) => unknown): FetchMock;
  mock: {
    calls: unknown[][];
    results: unknown[];
  };
};

export {}; // Make this file a module

declare global {
  const jest: {
    fn(): JestMock;
    fn<T extends (...args: any[]) => any>(implementation?: T): JestMock;
    Mock: JestMock;
    clearAllMocks(): void;
    spyOn(object: unknown, method: string): JestMock;
    mock(moduleName: string, factory?: () => unknown): typeof jest;
  };

  var fetch: FetchMock;

  var mockRemoveChild: JestMock;
  var mockAppendChild: JestMock;
  var MediaStream: JestMock;
  var MediaStreamTrack: JestMock;
  var HTMLAudioElement: JestMock;
  var TextDecoder: JestMock;
  var TextEncoder: JestMock;
  var document: {
    body: any;
  };
  var Node: any;

  function beforeEach(fn: () => void): void;
  function afterEach(fn: () => void): void;
}

// Mock LiveKit client for testing
jest.mock('livekit-client', () => ({
  Room: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    prepareConnection: jest.fn(),
    localParticipant: {
      setMicrophoneEnabled: jest.fn(),
      registerRpcMethod: jest.fn(),
      getTrackPublication: jest.fn(),
    },
    on: jest.fn().mockReturnThis(),
    name: 'test-room',
  })),
  RoomEvent: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    DataReceived: 'dataReceived',
    ConnectionStateChanged: 'connectionStateChanged',
    MediaDevicesError: 'mediaDevicesError',
  },
  Track: {
    Kind: {
      Audio: 'audio',
      Video: 'video',
    },
    Source: {
      Microphone: 'microphone',
    },
  },
  VideoPresets: {
    h720: {
      resolution: { width: 1280, height: 720 },
    },
  },
  RpcError: class RpcError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RpcError';
    }
  },
}));

// Mock DOM APIs
global.MediaStream = jest.fn().mockImplementation(() => ({
  getTracks: jest.fn(() => []),
  getAudioTracks: jest.fn(() => []),
  getVideoTracks: jest.fn(() => []),
}));

global.MediaStreamTrack = jest.fn().mockImplementation(() => ({
  kind: 'audio',
  id: 'mock-track-id',
  label: 'mock-track',
  enabled: true,
  muted: false,
  readyState: 'live',
  stop: jest.fn(),
  clone: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

global.HTMLAudioElement = jest.fn().mockImplementation(() => {
  const mockAddEventListener = jest.fn();
  return {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    addEventListener: mockAddEventListener,
    removeEventListener: jest.fn(),
    volume: 1.0,
    autoplay: false,
    style: {},
    parentNode: {
      removeChild: jest.fn(),
    },
    nodeType: 1,
    // Make mock property available for assertions
    mock: mockAddEventListener.mock,
  };
});

// Mock document.body for audio element attachment
global.mockRemoveChild = jest.fn();
global.mockAppendChild = jest.fn();

const mockBody = {
  appendChild: global.mockAppendChild,
  removeChild: global.mockRemoveChild,
};

global.document = {
  body: mockBody,
};

// Setup global fetch mock
global.fetch = jest.fn() as FetchMock;

// Mock Node interface for proper DOM operations
global.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};

// Suppress console errors during tests (they are intentional test scenarios)
// biome-ignore lint/suspicious/noConsole: Need to save original console for test utilities
const originalConsoleError = console.error;
// biome-ignore lint/suspicious/noConsole: Need to save original console for test utilities
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console output during tests
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console after each test
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock TextDecoder and TextEncoder
global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn((data: Uint8Array) => {
    // Convert Uint8Array back to string for proper JSON parsing
    const str = String.fromCharCode.apply(null, Array.from(data));
    return str;
  }),
}));

global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn((str: string) => new Uint8Array(Buffer.from(str, 'utf8'))),
}));
