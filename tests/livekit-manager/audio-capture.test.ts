/**
 * LiveKit Manager - Audio Capture Tests
 *
 * Comprehensive tests for audio capture functionality including:
 * - Level 1 API (simple onAudioData callback)
 * - Level 2 API (inline captureAudio configuration)
 * - Level 3 API (dynamic enable/disable methods)
 * - All audio formats (opus-webm, pcm-f32, pcm-i16)
 * - All audio sources (agent, user, both)
 * - Error handling and edge cases
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { AudioCaptureOptions } from '../../src/classes/types';
import { setupTest, type TestContext } from './shared-setup';

// Helper to access private properties in tests
function getPrivateProperty<T>(obj: any, prop: string): T {
  return obj[prop];
}

// Mock MediaRecorder
class MockMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MediaStream;
  options?: { mimeType?: string };

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.options = options;
  }

  start(timeslice?: number): void {
    this.state = 'recording';
    // Simulate data availability after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['mock audio data'], {
          type: 'audio/webm;codecs=opus',
        });
        this.ondataavailable({ data: mockBlob });
      }
      // biome-ignore lint/style/noMagicNumbers: Default timeslice for mock
    }, timeslice || 100);
  }

  stop(): void {
    this.state = 'inactive';
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }
}

// Mock ScriptProcessorNode
class MockScriptProcessorNode {
  onaudioprocess:
    | ((event: {
        inputBuffer: {
          getChannelData: (channel: number) => Float32Array;
          sampleRate: number;
          numberOfChannels: number;
        };
      }) => void)
    | null = null;

  // biome-ignore lint/suspicious/noEmptyBlockStatements: Mock methods
  connect(): void {}
  // biome-ignore lint/suspicious/noEmptyBlockStatements: Mock methods
  disconnect(): void {}
}

// Mock AudioContext
class MockAudioContext {
  createMediaStreamSource(): {
    connect: jest.Mock;
  } {
    return {
      connect: jest.fn(),
    };
  }

  createScriptProcessor(
    _bufferSize?: number,
    _numberOfInputChannels?: number,
    _numberOfOutputChannels?: number
  ): MockScriptProcessorNode {
    return new MockScriptProcessorNode();
  }

  get destination(): { connect: jest.Mock } {
    return { connect: jest.fn() };
  }
}

describe('LiveKitManager - Audio Capture', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();

    // Mock global MediaRecorder
    (global as any).MediaRecorder = MockMediaRecorder;
    (global as any).MediaRecorder.isTypeSupported = jest
      .fn()
      .mockReturnValue(true);

    // Mock global AudioContext
    (global as any).AudioContext = MockAudioContext;
  });

  describe('Level 3 API - Dynamic Control (enableAudioCapture/disableAudioCapture)', () => {
    describe('Enable Audio Capture', () => {
      test('should enable audio capture with default options', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          callback,
        });

        expect(
          getPrivateProperty<boolean>(
            liveKitManager.audioManager,
            'audioCaptureEnabled'
          )
        ).toBe(true);
        expect(
          getPrivateProperty<AudioCaptureOptions | null>(
            liveKitManager.audioManager,
            'audioCaptureOptions'
          )
        ).toMatchObject({
          source: 'agent',
          format: 'opus-webm',
          chunkSize: 100,
          bufferSize: 4096,
        });
      });

      test('should throw error when no callback provided', () => {
        const { liveKitManager } = context;

        expect(() => {
          liveKitManager.audioManager.enableAudioCapture(
            {} as AudioCaptureOptions
          );
        }).toThrow(
          'Audio capture requires either "callback" or "onData" option'
        );
      });

      test('should accept callback via "onData" parameter', () => {
        const { liveKitManager } = context;
        const onData = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          onData,
        });

        expect(
          getPrivateProperty<boolean>(
            liveKitManager.audioManager,
            'audioCaptureEnabled'
          )
        ).toBe(true);
        expect(
          getPrivateProperty<AudioCaptureOptions | null>(
            liveKitManager.audioManager,
            'audioCaptureOptions'
          )?.callback
        ).toBe(onData);
      });

      test('should prefer "callback" over "onData" when both provided', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();
        const onData = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          callback,
          onData,
        });

        expect(
          getPrivateProperty<AudioCaptureOptions | null>(
            liveKitManager.audioManager,
            'audioCaptureOptions'
          )?.callback
        ).toBe(callback);
      });
    });

    describe('Disable Audio Capture', () => {
      test('should disable audio capture and clean up resources', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({ callback });
        expect(
          getPrivateProperty<boolean>(
            liveKitManager.audioManager,
            'audioCaptureEnabled'
          )
        ).toBe(true);

        liveKitManager.audioManager.disableAudioCapture();
        expect(
          getPrivateProperty<boolean>(
            liveKitManager.audioManager,
            'audioCaptureEnabled'
          )
        ).toBe(false);
        expect(
          getPrivateProperty<AudioCaptureOptions | null>(
            liveKitManager.audioManager,
            'audioCaptureOptions'
          )
        ).toBeNull();
      });

      test('should be safe to call when audio capture not enabled', () => {
        const { liveKitManager } = context;

        expect(() => {
          liveKitManager.audioManager.disableAudioCapture();
        }).not.toThrow();
      });

      test('should resume AudioContext if suspended', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        // Setup mock to return suspended state
        const mockResume = jest.fn().mockResolvedValue(undefined as never);
        const originalAudioContext = (global as any).AudioContext;

        (global as any).AudioContext = class extends MockAudioContext {
          state = 'suspended';
          resume = mockResume;
        };

        // Reset audio context to force new creation with our mock
        (liveKitManager.audioManager as any).audioContext = null;

        // Add mock participant to room so getTrackById can find it
        const mockTrack = {
          sid: 'test-track',
          kind: 'audio',
          mediaStreamTrack: { id: 'test-track' },
          attach: jest.fn().mockReturnValue(document.createElement('audio')),
        };
        const mockPublication = { track: mockTrack };
        const mockRemoteParticipant = {
          identity: 'agent-123',
          trackPublications: new Map([['test-track', mockPublication]]),
          getTrackPublication: jest.fn().mockReturnValue(mockPublication),
        };
        (context.mockRoom.remoteParticipants as Map<string, any>).set(
          'agent-123',
          mockRemoteParticipant
        );

        liveKitManager.audioManager.handleTrackSubscribed(
          mockTrack as any,
          mockPublication as any,
          { identity: 'agent-123' } as any
        );

        liveKitManager.audioManager.enableAudioCapture({
          callback,
          format: 'pcm-f32',
        });

        expect(mockResume).toHaveBeenCalled();

        // Restore original mock
        (global as any).AudioContext = originalAudioContext;
      });

      test('should stop recording when disabling', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({ callback });

        // Create mock recorder
        const mockRecorder = new MockMediaRecorder(new MediaStream());
        const stopSpy = jest.spyOn(mockRecorder, 'stop');
        const audioManager = liveKitManager.audioManager as any;
        audioManager.recorders.set('test-track', mockRecorder);

        liveKitManager.audioManager.disableAudioCapture();

        expect(stopSpy).toHaveBeenCalled();
        expect(
          getPrivateProperty<Map<string, MediaRecorder>>(
            liveKitManager.audioManager,
            'recorders'
          ).size
        ).toBe(0);
      });

      test('should disconnect ScriptProcessorNode when disabling', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({ callback });

        // Create mock processor
        const mockProcessor = new MockScriptProcessorNode();
        const disconnectSpy = jest.spyOn(mockProcessor, 'disconnect');
        const audioManager = liveKitManager.audioManager as any;
        audioManager.processors.set('test-track', mockProcessor);

        liveKitManager.audioManager.disableAudioCapture();

        expect(disconnectSpy).toHaveBeenCalled();
        expect(
          getPrivateProperty<Map<string, ScriptProcessorNode>>(
            liveKitManager.audioManager,
            'processors'
          ).size
        ).toBe(0);
      });

      test('should fallback to supported MIME type on Safari', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        // Mock Safari behavior: opus-webm not supported, mp4 supported
        (global as any).MediaRecorder.isTypeSupported = jest.fn(
          (type: string) => {
            return type === 'audio/mp4';
          }
        );

        // Add mock participant to room so getTrackById can find it
        const mockTrack = {
          sid: 'test-track',
          kind: 'audio',
          mediaStreamTrack: { id: 'test-track' },
          attach: jest.fn().mockReturnValue(document.createElement('audio')),
        };
        const mockPublication = { track: mockTrack };
        const mockRemoteParticipant = {
          identity: 'agent-123',
          trackPublications: new Map([['test-track', mockPublication]]),
          getTrackPublication: jest.fn().mockReturnValue(mockPublication),
        };
        (context.mockRoom.remoteParticipants as Map<string, any>).set(
          'agent-123',
          mockRemoteParticipant
        );

        liveKitManager.audioManager.handleTrackSubscribed(
          mockTrack as any,
          mockPublication as any,
          { identity: 'agent-123' } as any
        );

        liveKitManager.audioManager.enableAudioCapture({
          callback,
          format: 'opus-webm',
        });

        const audioManager = liveKitManager.audioManager as any;
        const recorder = audioManager.recorders.get('test-track');

        expect(recorder).toBeDefined();
      });

      test('should handle multiple tracks correctly', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({ callback });

        // Create mock recorders for two tracks
        const mockRecorder1 = new MockMediaRecorder(new MediaStream());
        const mockRecorder2 = new MockMediaRecorder(new MediaStream());
        const stopSpy1 = jest.spyOn(mockRecorder1, 'stop');
        const stopSpy2 = jest.spyOn(mockRecorder2, 'stop');

        const audioManager = liveKitManager.audioManager as any;
        audioManager.recorders.set('track-1', mockRecorder1);
        audioManager.recorders.set('track-2', mockRecorder2);

        expect(
          getPrivateProperty<Map<string, MediaRecorder>>(
            liveKitManager.audioManager,
            'recorders'
          ).size
        ).toBe(2);

        liveKitManager.audioManager.disableAudioCapture();

        expect(stopSpy1).toHaveBeenCalled();
        expect(stopSpy2).toHaveBeenCalled();
        expect(
          getPrivateProperty<Map<string, MediaRecorder>>(
            liveKitManager.audioManager,
            'recorders'
          ).size
        ).toBe(0);
      });
    });
  });

  describe('Audio Capture Formats', () => {
    describe('opus-webm format (default)', () => {
      test('should accept opus-webm format configuration', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          source: 'agent',
          format: 'opus-webm',
          chunkSize: 100,
          callback,
        });

        const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
          liveKitManager.audioManager,
          'audioCaptureOptions'
        );
        expect(captureOptions?.format).toBe('opus-webm');
        // biome-ignore lint/style/noMagicNumbers: Testing default value
        expect(captureOptions?.chunkSize).toBe(100);
      });
    });

    describe('pcm-f32 format', () => {
      test('should accept pcm-f32 format configuration', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          source: 'agent',
          format: 'pcm-f32',
          bufferSize: 4096,
          callback,
        });

        const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
          liveKitManager.audioManager,
          'audioCaptureOptions'
        );
        expect(captureOptions?.format).toBe('pcm-f32');
        // biome-ignore lint/style/noMagicNumbers: Testing default value
        expect(captureOptions?.bufferSize).toBe(4096);
      });
    });

    describe('pcm-i16 format', () => {
      test('should accept pcm-i16 format configuration', () => {
        const { liveKitManager } = context;
        const callback = jest.fn();

        liveKitManager.audioManager.enableAudioCapture({
          source: 'agent',
          format: 'pcm-i16',
          bufferSize: 4096,
          callback,
        });

        const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
          liveKitManager.audioManager,
          'audioCaptureOptions'
        );
        expect(captureOptions?.format).toBe('pcm-i16');
        // biome-ignore lint/style/noMagicNumbers: Testing default value
        expect(captureOptions?.bufferSize).toBe(4096);
      });
    });
  });

  describe('Audio Capture Sources', () => {
    test('should configure source option correctly for "agent"', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({
        source: 'agent',
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.source).toBe('agent');
    });

    test('should configure source option correctly for "user"', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({
        source: 'user',
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.source).toBe('user');
    });

    test('should configure source option correctly for "both"', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({
        source: 'both',
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.source).toBe('both');
    });
  });

  describe('Audio Capture Metadata', () => {
    test('should store format in capture options', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({
        source: 'agent',
        format: 'opus-webm',
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.format).toBe('opus-webm');
    });
  });

  describe('Error Handling', () => {
    test('should not throw during enable with valid callback', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      expect(() => {
        liveKitManager.audioManager.enableAudioCapture({
          format: 'opus-webm',
          callback,
        });
      }).not.toThrow();
    });

    test('should not throw during enable with PCM format', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      expect(() => {
        liveKitManager.audioManager.enableAudioCapture({
          format: 'pcm-f32',
          callback,
        });
      }).not.toThrow();
    });

    test('should handle errors during cleanup gracefully', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({ callback });

      // Create mock recorder that throws on stop
      const mockRecorder = {
        stop: jest.fn().mockImplementation(() => {
          throw new Error('Stop failed');
        }),
      };
      const audioManager = liveKitManager.audioManager as any;
      audioManager.recorders.set('test-track', mockRecorder);

      // Should not throw
      expect(() => {
        liveKitManager.audioManager.disableAudioCapture();
      }).not.toThrow();

      // Recorder should be cleared despite error
      expect(
        getPrivateProperty<Map<string, MediaRecorder>>(
          liveKitManager.audioManager,
          'recorders'
        ).size
      ).toBe(0);
    });
  });

  describe('Configuration Options', () => {
    test('should store custom chunkSize in options', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();
      const customChunkSize = 250;

      liveKitManager.audioManager.enableAudioCapture({
        format: 'opus-webm',
        chunkSize: customChunkSize,
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.chunkSize).toBe(customChunkSize);
    });

    test('should store custom bufferSize in options', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();
      const customBufferSize = 8192;

      liveKitManager.audioManager.enableAudioCapture({
        format: 'pcm-f32',
        bufferSize: customBufferSize,
        callback,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        liveKitManager.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.bufferSize).toBe(customBufferSize);
    });
  });

  describe('Track Lifecycle', () => {
    test('should initialize with empty track capture map', () => {
      const { liveKitManager } = context;

      // Verify initial state
      expect(
        getPrivateProperty<Map<string, any>>(
          liveKitManager.audioManager,
          'trackCaptureMap'
        ).size
      ).toBe(0);
    });

    test('should maintain track capture map when capture is disabled', () => {
      const { liveKitManager } = context;

      // Verify NO capture when disabled
      expect(
        getPrivateProperty<boolean>(
          liveKitManager.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(false);
      expect(
        getPrivateProperty<Map<string, any>>(
          liveKitManager.audioManager,
          'trackCaptureMap'
        ).size
      ).toBe(0);
    });

    test('should clear track capture map on disable', () => {
      const { liveKitManager } = context;
      const callback = jest.fn();

      liveKitManager.audioManager.enableAudioCapture({ callback });

      // Add some mock state
      const trackCaptureMap = getPrivateProperty<Map<string, any>>(
        liveKitManager.audioManager,
        'trackCaptureMap'
      );
      trackCaptureMap.set('track-1', {
        participant: 'agent-123',
        source: 'agent',
      });
      trackCaptureMap.set('track-2', {
        participant: 'user-456',
        source: 'user',
      });

      expect(trackCaptureMap.size).toBe(2);

      liveKitManager.audioManager.disableAudioCapture();

      expect(trackCaptureMap.size).toBe(0);
    });
  });
});
