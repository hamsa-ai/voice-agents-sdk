/**
 * Audio Capture Integration Tests
 *
 * Tests for Level 1 and Level 2 audio capture APIs at the HamsaVoiceAgent level,
 * including integration with the start() method.
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type {
  AudioCaptureCallback,
  AudioCaptureMetadata,
  AudioCaptureOptions,
} from '../src/classes/types';
import HamsaVoiceAgent from '../src/main';
import { mockSuccessfulConversationInit } from './utils/fetch-mocks';
import { MOCK_CONFIG } from './utils/test-constants';
import {
  applyWakeLockMocks,
  createWakeLockMocks,
} from './utils/wake-lock-mocks';

// Test constants
const DEFAULT_CHUNK_SIZE = 100;
const CUSTOM_CHUNK_SIZE = 250;
const CUSTOM_BUFFER_SIZE = 16_384;

// Regex patterns for validation
const SOURCE_PATTERN = /^(agent|user)$/;
const FORMAT_PATTERN = /^(opus-webm|pcm-f32|pcm-i16)$/;

// Helper to access private properties in tests
function getPrivateProperty<T>(obj: any, prop: string): T {
  return obj[prop];
}

describe('HamsaVoiceAgent - Audio Capture Integration', () => {
  let voiceAgent: HamsaVoiceAgent;
  const mockApiKey = MOCK_CONFIG.API_KEY;
  const mockConfig = {
    API_URL: MOCK_CONFIG.API_URL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessfulConversationInit();
    voiceAgent = new HamsaVoiceAgent(mockApiKey, mockConfig);

    // Mock wake lock
    const wakeLockMocks = createWakeLockMocks();
    applyWakeLockMocks(voiceAgent, wakeLockMocks);
  });

  describe('Level 1 API - Simple onAudioData Callback', () => {
    test('should accept onAudioData callback in start options', async () => {
      const onAudioData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
      });

      // Verify audio capture was enabled automatically
      expect(voiceAgent.liveKitManager).not.toBeNull();
      const audioManager = voiceAgent.liveKitManager?.audioManager;
      expect(
        getPrivateProperty<boolean>(audioManager, 'audioCaptureEnabled')
      ).toBe(true);

      // Verify default configuration
      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions).toMatchObject({
        source: 'agent',
        format: 'opus-webm',
        chunkSize: DEFAULT_CHUNK_SIZE,
      });
      expect(captureOptions?.callback).toBe(onAudioData);
    });

    test('should use agent as default source with onAudioData', async () => {
      const onAudioData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.source).toBe('agent');
    });

    test('should use opus-webm as default format with onAudioData', async () => {
      const onAudioData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.format).toBe('opus-webm');
    });

    test('should use 100ms as default chunk size with onAudioData', async () => {
      const onAudioData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
    });

    test('should not enable capture when onAudioData is not provided', async () => {
      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(false);
    });
  });

  describe('Level 2 API - Advanced captureAudio Configuration', () => {
    test('should accept captureAudio configuration in start options', async () => {
      const onData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          source: 'both',
          format: 'pcm-f32',
          bufferSize: 8192,
          onData,
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions).toMatchObject({
        source: 'both',
        format: 'pcm-f32',
        bufferSize: 8192,
      });
      expect(captureOptions?.callback).toBe(onData);
    });

    test('should support all source options in captureAudio', async () => {
      const sources: Array<'agent' | 'user' | 'both'> = [
        'agent',
        'user',
        'both',
      ];

      for (const source of sources) {
        const onData = jest.fn();
        const agent = new HamsaVoiceAgent(mockApiKey, mockConfig);
        const wakeLockMocks = createWakeLockMocks();
        applyWakeLockMocks(agent, wakeLockMocks);

        await agent.start({
          agentId: 'test-agent',
          voiceEnablement: true,
          captureAudio: {
            source,
            onData,
          },
        });

        const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
          agent.liveKitManager?.audioManager,
          'audioCaptureOptions'
        );
        expect(captureOptions?.source).toBe(source);
      }
    });

    test('should support all format options in captureAudio', async () => {
      const formats: Array<'opus-webm' | 'pcm-f32' | 'pcm-i16'> = [
        'opus-webm',
        'pcm-f32',
        'pcm-i16',
      ];

      for (const format of formats) {
        const onData = jest.fn();
        const agent = new HamsaVoiceAgent(mockApiKey, mockConfig);
        const wakeLockMocks = createWakeLockMocks();
        applyWakeLockMocks(agent, wakeLockMocks);

        await agent.start({
          agentId: 'test-agent',
          voiceEnablement: true,
          captureAudio: {
            format,
            onData,
          },
        });

        const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
          agent.liveKitManager?.audioManager,
          'audioCaptureOptions'
        );
        expect(captureOptions?.format).toBe(format);
      }
    });

    test('should support custom chunkSize in captureAudio', async () => {
      const onData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          format: 'opus-webm',
          chunkSize: 250,
          onData,
        },
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.chunkSize).toBe(CUSTOM_CHUNK_SIZE);
    });

    test('should support custom bufferSize in captureAudio', async () => {
      const onData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          format: 'pcm-f32',
          bufferSize: 16_384,
          onData,
        },
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.bufferSize).toBe(CUSTOM_BUFFER_SIZE);
    });

    test('should support both callback and onData in captureAudio', async () => {
      const callback = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          callback,
        },
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      expect(captureOptions?.callback).toBe(callback);
    });
  });

  describe('Level 1 vs Level 2 Priority', () => {
    test('should prioritize captureAudio over onAudioData when both provided', async () => {
      const onAudioData = jest.fn();
      const captureAudioCallback = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
        captureAudio: {
          source: 'both',
          format: 'pcm-f32',
          onData: captureAudioCallback,
        },
      });

      const captureOptions = getPrivateProperty<AudioCaptureOptions | null>(
        voiceAgent.liveKitManager?.audioManager,
        'audioCaptureOptions'
      );
      // Callback should be the one from captureAudio
      expect(captureOptions?.callback).toBeDefined();
      expect(captureOptions?.source).toBe('both');
      expect(captureOptions?.format).toBe('pcm-f32');
    });
  });

  describe('Level 3 API - Public Methods', () => {
    test('should have enableAudioCapture method', () => {
      expect(typeof voiceAgent.enableAudioCapture).toBe('function');
    });

    test('should have disableAudioCapture method', () => {
      expect(typeof voiceAgent.disableAudioCapture).toBe('function');
    });

    test('should enable audio capture dynamically', async () => {
      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(false);

      const callback = jest.fn();
      voiceAgent.enableAudioCapture({
        source: 'agent',
        callback,
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('should disable audio capture dynamically', async () => {
      const onAudioData = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData,
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);

      voiceAgent.disableAudioCapture();

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(false);
    });

    test('should throw error when enabling capture before connection', () => {
      expect(() => {
        voiceAgent.enableAudioCapture({
          callback: jest.fn(),
        });
      }).toThrow('Cannot enable audio capture: not connected to agent');
    });

    test('should not throw when disabling capture before connection', () => {
      expect(() => {
        voiceAgent.disableAudioCapture();
      }).not.toThrow();
    });
  });

  describe('Real-World Use Cases', () => {
    test('should support forwarding to third-party service', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        readyState: 1, // OPEN
      };

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData: (audioData: ArrayBuffer | Float32Array | Int16Array) => {
          if (mockWebSocket.readyState === 1) {
            mockWebSocket.send(audioData);
          }
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('should support custom audio processing', async () => {
      const audioProcessor = {
        process: jest.fn(),
      };

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          format: 'pcm-f32',
          onData: (
            audioData: ArrayBuffer | Float32Array | Int16Array,
            metadata: AudioCaptureMetadata
          ) => {
            audioProcessor.process(audioData, metadata.sampleRate);
          },
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('should support separate handling for agent and user', async () => {
      const agentHandler = jest.fn();
      const userHandler = jest.fn();

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          source: 'both',
          onData: (
            audioData: ArrayBuffer | Float32Array | Int16Array,
            metadata: AudioCaptureMetadata
          ) => {
            if (metadata.source === 'agent') {
              agentHandler(audioData, metadata);
            } else {
              userHandler(audioData, metadata);
            }
          },
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('should support conditional capture enablement', async () => {
      const userWantsRecording = true;

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
      });

      // biome-ignore lint/nursery/noUnnecessaryConditions: Example code showing conditional usage
      if (userWantsRecording) {
        voiceAgent.enableAudioCapture({
          source: 'agent',
          format: 'opus-webm',
          callback: jest.fn(),
        });
      }

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });
  });

  describe('Type Safety', () => {
    test('should accept valid AudioCaptureCallback signature', async () => {
      const typedCallback: AudioCaptureCallback = (
        _audioData: ArrayBuffer | Float32Array | Int16Array,
        metadata: AudioCaptureMetadata
      ) => {
        expect(metadata.participant).toBeDefined();
        expect(metadata.source).toMatch(SOURCE_PATTERN);
        expect(metadata.timestamp).toBeGreaterThan(0);
        expect(metadata.trackId).toBeDefined();
        expect(metadata.format).toMatch(FORMAT_PATTERN);
      };

      await voiceAgent.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        onAudioData: typedCallback,
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('should provide correct metadata types for different formats', async () => {
      // Test opus-webm
      const opusCallback: AudioCaptureCallback = (audioData, metadata) => {
        if (metadata.format === 'opus-webm') {
          expect(audioData).toBeInstanceOf(ArrayBuffer);
          expect(metadata.sampleRate).toBeUndefined();
          expect(metadata.channels).toBeUndefined();
        }
      };

      const agent1 = new HamsaVoiceAgent(mockApiKey, mockConfig);
      applyWakeLockMocks(agent1, createWakeLockMocks());

      await agent1.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          format: 'opus-webm',
          onData: opusCallback,
        },
      });

      // Test pcm-f32
      const pcmCallback: AudioCaptureCallback = (audioData, metadata) => {
        if (metadata.format === 'pcm-f32') {
          expect(audioData).toBeInstanceOf(Float32Array);
          expect(metadata.sampleRate).toBeDefined();
          expect(metadata.channels).toBeDefined();
        }
      };

      const agent2 = new HamsaVoiceAgent(mockApiKey, mockConfig);
      applyWakeLockMocks(agent2, createWakeLockMocks());

      await agent2.start({
        agentId: 'test-agent',
        voiceEnablement: true,
        captureAudio: {
          format: 'pcm-f32',
          onData: pcmCallback,
        },
      });
    });
  });

  describe('Documentation Examples', () => {
    test('README example - Simple callback', async () => {
      const thirdPartyWebSocket = {
        send: jest.fn(),
      };

      await voiceAgent.start({
        agentId: 'agent-123',
        voiceEnablement: true,
        onAudioData: (audioData) => {
          thirdPartyWebSocket.send(audioData);
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('README example - Inline configuration', async () => {
      const processAgentAudio = jest.fn();
      const processUserAudio = jest.fn();

      await voiceAgent.start({
        agentId: 'agent-123',
        voiceEnablement: true,
        captureAudio: {
          source: 'both',
          format: 'pcm-f32',
          bufferSize: 4096,
          onData: (audioData, metadata) => {
            if (metadata.source === 'agent') {
              processAgentAudio(audioData);
            } else {
              processUserAudio(audioData);
            }
          },
        },
      });

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(true);
    });

    test('README example - Dynamic control', async () => {
      const userWantsRecording = true;
      const thirdPartyWebSocket = {
        send: jest.fn(),
      };

      await voiceAgent.start({
        agentId: 'agent-123',
        voiceEnablement: true,
      });

      // biome-ignore lint/nursery/noUnnecessaryConditions: Example code showing conditional usage
      if (userWantsRecording) {
        voiceAgent.enableAudioCapture({
          source: 'agent',
          format: 'opus-webm',
          chunkSize: 100,
          callback: (audioData) => {
            thirdPartyWebSocket.send(audioData);
          },
        });
      }

      voiceAgent.disableAudioCapture();

      expect(
        getPrivateProperty<boolean>(
          voiceAgent.liveKitManager?.audioManager,
          'audioCaptureEnabled'
        )
      ).toBe(false);
    });
  });
});
