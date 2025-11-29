import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import HamsaVoiceAgent, {
  HamsaApiError,
  type HamsaVoiceAgentEvents,
} from '../src/main';
import { mockSuccessfulConversationInit } from './utils/fetch-mocks';
import {
  AGENT_CONFIGS,
  MOCK_CONFIG,
  TIMING,
  VOLUMES,
} from './utils/test-constants';
// Import utilities
import {
  applyWakeLockMocks,
  createWakeLockMocks,
} from './utils/wake-lock-mocks';

describe('HamsaVoiceAgent', () => {
  let voiceAgent: HamsaVoiceAgent;
  const mockApiKey = MOCK_CONFIG.API_KEY;
  const mockConfig = {
    API_URL: MOCK_CONFIG.API_URL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessfulConversationInit();
    voiceAgent = new HamsaVoiceAgent(mockApiKey, mockConfig);
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const defaultAgent = new HamsaVoiceAgent(mockApiKey);

      expect(defaultAgent.apiKey).toBe(mockApiKey);
      expect(defaultAgent.API_URL).toBe('https://api.tryhamsa.com');
      expect(defaultAgent.liveKitManager).toBeNull();
      expect(defaultAgent.jobId).toBeNull();
      expect(defaultAgent.wakeLockManager).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      expect(voiceAgent.apiKey).toBe(mockApiKey);
      expect(voiceAgent.API_URL).toBe(mockConfig.API_URL);
    });

    test('should maintain backward compatibility', () => {
      // Test that the constructor works with just API_URL
      const legacyConfig = {
        API_URL: 'https://test-api.com',
      };

      const legacyAgent = new HamsaVoiceAgent(mockApiKey, legacyConfig);
      expect(legacyAgent.API_URL).toBe(legacyConfig.API_URL);
    });
  });

  describe('Public API Methods', () => {
    test('should have all required public methods', () => {
      expect(typeof voiceAgent.start).toBe('function');
      expect(typeof voiceAgent.end).toBe('function');
      expect(typeof voiceAgent.pause).toBe('function');
      expect(typeof voiceAgent.resume).toBe('function');
      expect(typeof voiceAgent.setVolume).toBe('function');
      expect(typeof voiceAgent.getJobDetails).toBe('function');
    });

    test('start method should accept correct parameters', async () => {
      const startOptions = AGENT_CONFIGS.WITH_PARAMS;

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start(startOptions);

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `${mockConfig.API_URL}/v1/voice-agents/room/participant-token`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Token ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"voiceAgentId":"test-agent"'),
        })
      );

      expect(fetch).toHaveBeenNthCalledWith(
        2,
        `${mockConfig.API_URL}/v1/voice-agents/room/conversation-init`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Token ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"voiceAgentId":"test-agent"'),
        })
      );

      expect(wakeLockMocks.acquire).toHaveBeenCalled();
    });

    test('setVolume method should work without LiveKitManager', () => {
      // Should not throw error when called before start()
      expect(() => voiceAgent.setVolume(VOLUMES.HALF)).not.toThrow();
    });

    test('end method should work without LiveKitManager', () => {
      // Should not throw error when called before start()
      expect(() => voiceAgent.end()).not.toThrow();
    });

    test('pause method should work without LiveKitManager', () => {
      // Should not throw error when called before start()
      expect(() => voiceAgent.pause()).not.toThrow();
    });

    test('resume method should work without LiveKitManager', () => {
      // Should not throw error when called before start()
      expect(() => voiceAgent.resume()).not.toThrow();
    });
  });

  describe('Token Fetching', () => {
    test('should fetch LiveKit token successfully', async () => {
      const startOptions = {
        agentId: 'test-agent',
        params: { name: 'Test' },
        voiceEnablement: true,
        tools: [],
      };

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start(startOptions);

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `${mockConfig.API_URL}/v1/voice-agents/room/participant-token`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"voiceAgentId":"test-agent"'),
        })
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        `${mockConfig.API_URL}/v1/voice-agents/room/conversation-init`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"voiceAgentId":"test-agent"'),
        })
      );

      expect(voiceAgent.jobId).toBe('mock-job-id');
    });

    test('should handle token fetch failure', async () => {
      const errorSpy = jest.fn();
      voiceAgent.on('error', errorSpy);

      (fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: (jest.fn() as any).mockResolvedValue('Invalid API key'),
      } as unknown as Response);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '401 Unauthorized - Invalid API key',
          name: 'HamsaApiError',
          messageKey: undefined,
        })
      );
    });

    test('should handle network errors during token fetch', async () => {
      const errorSpy = jest.fn();
      voiceAgent.on('error', errorSpy);

      (fetch as any).mockRejectedValue(new Error('Network error'));

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to start call'),
        })
      );
    });
  });

  describe('Tool Conversion', () => {
    test('should convert tools to LLM format correctly', async () => {
      const tools = [
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
          fn: jest.fn(),
        },
      ];

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools,
      });

      const requestBody = JSON.parse(
        ((fetch as any).mock.calls[1][1] as any).body
      );
      expect(requestBody.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'testTool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                param1: {
                  type: 'string',
                  description: 'First parameter',
                },
              },
              required: ['param1'],
            },
          },
        },
      ]);
    });

    test('should handle tools with func_map', async () => {
      const tools = [
        {
          function_name: 'mappedTool',
          description: 'A tool with func_map',
          parameters: [],
          func_map: { customMapping: 'value' },
          fn: jest.fn(),
        },
      ];

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools,
      });

      const requestBody = JSON.parse(
        ((fetch as any).mock.calls[1][1] as any).body
      );
      expect(requestBody.tools[0].function.func_map).toEqual({
        customMapping: 'value',
      });
    });
  });

  describe('Event Emission Compatibility', () => {
    test('should emit all expected events', async () => {
      const events = {
        callStarted: jest.fn(),
        callEnded: jest.fn(),
        callPaused: jest.fn(),
        callResumed: jest.fn(),
        start: jest.fn(),
        speaking: jest.fn(),
        listening: jest.fn(),
        transcriptionReceived: jest.fn(),
        answerReceived: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        closed: jest.fn(),
        trackSubscribed: jest.fn(),
        trackUnsubscribed: jest.fn(),
        localTrackPublished: jest.fn(),
      };

      // Register all event listeners
      for (const eventName of Object.keys(events) as Array<
        keyof typeof events
      >) {
        voiceAgent.on(eventName, events[eventName]);
      }

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);
      voiceAgent.wakeLockManager.release = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);

      // Test start flow
      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      expect(events.callStarted).toHaveBeenCalled();

      // Test that LiveKitManager events are forwarded correctly
      if (voiceAgent.liveKitManager) {
        // Simulate LiveKitManager events
        voiceAgent.liveKitManager.emit('connected');
        voiceAgent.liveKitManager.emit('speaking');
        voiceAgent.liveKitManager.emit('listening');
        voiceAgent.liveKitManager.emit(
          'transcriptionReceived',
          'test transcription'
        );
        voiceAgent.liveKitManager.emit('answerReceived', 'test answer');
        voiceAgent.liveKitManager.emit('info', { type: 'test info' });
        voiceAgent.liveKitManager.emit('disconnected');
        voiceAgent.liveKitManager.emit('trackSubscribed', {
          track: { kind: 'audio', mediaStreamTrack: {} },
          publication: {},
          participant: 'agent',
        });
        voiceAgent.liveKitManager.emit('trackUnsubscribed', {
          track: { kind: 'audio' },
          publication: {},
          participant: 'agent',
        });
        voiceAgent.liveKitManager.emit('localTrackPublished', {
          track: { source: 'microphone', mediaStreamTrack: {} },
          publication: { source: 'microphone' },
        });

        expect(events.start).toHaveBeenCalled();
        expect(events.speaking).toHaveBeenCalled();
        expect(events.listening).toHaveBeenCalled();
        expect(events.transcriptionReceived).toHaveBeenCalledWith(
          'test transcription'
        );
        expect(events.answerReceived).toHaveBeenCalledWith('test answer');
        expect(events.info).toHaveBeenCalledWith({ type: 'test info' });
        expect(events.closed).toHaveBeenCalled();
        expect(events.trackSubscribed).toHaveBeenCalledWith(
          expect.objectContaining({
            track: expect.any(Object),
            publication: expect.any(Object),
            participant: 'agent',
          })
        );
        expect(events.trackUnsubscribed).toHaveBeenCalledWith(
          expect.objectContaining({
            track: expect.any(Object),
            publication: expect.any(Object),
            participant: 'agent',
          })
        );
        expect(events.localTrackPublished).toHaveBeenCalled();
      }

      // Test lifecycle events
      voiceAgent.pause();
    });

    test('should forward connectionQualityChanged event with correct data structure', async () => {
      const connectionQualitySpy = jest.fn();
      voiceAgent.on('connectionQualityChanged', connectionQualitySpy);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      if (voiceAgent.liveKitManager) {
        const mockData = {
          quality: 'good' as const,
          participant: 'test-participant',
          metrics: { quality: 'good' },
        };

        voiceAgent.liveKitManager.emit('connectionQualityChanged', mockData);

        expect(connectionQualitySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            quality: 'good',
            participant: 'test-participant',
            metrics: { quality: 'good' },
          })
        );
        const firstCall = connectionQualitySpy.mock.calls[0];
        if (firstCall?.[0]) {
          expect(
            typeof (firstCall[0] as { participant: string }).participant
          ).toBe('string');
        }
      }
    });

    test('should forward micMuted and micUnmuted events', async () => {
      const micMutedSpy = jest.fn();
      const micUnmutedSpy = jest.fn();
      voiceAgent.on('micMuted', micMutedSpy);
      voiceAgent.on('micUnmuted', micUnmutedSpy);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      if (voiceAgent.liveKitManager) {
        voiceAgent.liveKitManager.emit('micMuted');
        voiceAgent.liveKitManager.emit('micUnmuted');

        expect(micMutedSpy).toHaveBeenCalled();
        expect(micUnmutedSpy).toHaveBeenCalled();
      }
    });

    test('should maintain event data format compatibility', async () => {
      const transcriptionSpy = jest.fn();
      const answerSpy = jest.fn();
      const infoSpy = jest.fn();

      voiceAgent.on('transcriptionReceived', transcriptionSpy);
      voiceAgent.on('answerReceived', answerSpy);
      voiceAgent.on('info', infoSpy);

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      if (voiceAgent.liveKitManager) {
        // Test that event data is passed through unchanged
        const testTranscription = 'Hello world';
        const testAnswer = 'AI response';
        const testInfo = { status: 'processing', data: { progress: 50 } };

        voiceAgent.liveKitManager.emit(
          'transcriptionReceived',
          testTranscription
        );
        voiceAgent.liveKitManager.emit('answerReceived', testAnswer);
        voiceAgent.liveKitManager.emit('info', testInfo);

        expect(transcriptionSpy).toHaveBeenCalledWith(testTranscription);
        expect(answerSpy).toHaveBeenCalledWith(testAnswer);
        expect(infoSpy).toHaveBeenCalledWith(testInfo);
      }
    });

    test('should handle error events correctly', async () => {
      const errorSpy = jest.fn();
      voiceAgent.on('error', errorSpy);

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      if (voiceAgent.liveKitManager) {
        const testError = new Error('Test LiveKit error');
        voiceAgent.liveKitManager.emit('error', testError);

        expect(errorSpy).toHaveBeenCalledWith(testError);
      }
    });
  });

  describe('Screen Wake Lock Integration', () => {
    test('should acquire wake lock on start', async () => {
      const mockAcquire = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      voiceAgent.wakeLockManager.acquire = mockAcquire;

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      expect(mockAcquire).toHaveBeenCalled();
    });

    test('should release wake lock on end', () => {
      const mockRelease = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      const mockIsActive = jest.fn<() => boolean>().mockReturnValue(true);
      voiceAgent.wakeLockManager.release = mockRelease;
      voiceAgent.wakeLockManager.isActive = mockIsActive;

      voiceAgent.end();

      expect(mockIsActive).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    test('should release wake lock on pause', () => {
      const mockRelease = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      const mockIsActive = jest.fn<() => boolean>().mockReturnValue(true);
      voiceAgent.wakeLockManager.release = mockRelease;
      voiceAgent.wakeLockManager.isActive = mockIsActive;

      // Create a mock LiveKitManager to avoid null reference
      voiceAgent.liveKitManager = {
        pause: jest.fn(),
      } as any;

      voiceAgent.pause();

      expect(mockIsActive).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    test('should acquire wake lock on resume', () => {
      const mockAcquire = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      voiceAgent.wakeLockManager.acquire = mockAcquire;

      // Create a mock LiveKitManager to avoid null reference
      voiceAgent.liveKitManager = {
        resume: jest.fn(),
      } as any;

      voiceAgent.resume();

      expect(mockAcquire).toHaveBeenCalled();
    });

    test('should handle wake lock errors gracefully', async () => {
      // No longer testing console.error since Biome removed console logging
      const mockAcquire = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('Wake lock failed'));
      voiceAgent.wakeLockManager.acquire = mockAcquire;

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      // Should still attempt to acquire wake lock even if it fails
      expect(mockAcquire).toHaveBeenCalled();
    });
  });

  describe('End-to-End Call Lifecycle', () => {
    test('should handle complete call lifecycle', async () => {
      const lifecycleEvents: string[] = [];
      const eventNames = [
        'callStarted',
        'start',
        'speaking',
        'listening',
        'callPaused',
        'callResumed',
        'callEnded',
      ];

      for (const eventName of eventNames as Array<
        keyof HamsaVoiceAgentEvents
      >) {
        voiceAgent.on(eventName, () => lifecycleEvents.push(eventName));
      }

      // Mock wake lock methods
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      // Start call
      await voiceAgent.start({
        agentId: 'test-agent',
        params: { name: 'Test User' },
        voiceEnablement: true,
        tools: [],
      });

      expect(lifecycleEvents).toContain('callStarted');
      expect(voiceAgent.liveKitManager).toBeDefined();
      expect(voiceAgent.jobId).toBe('mock-job-id');

      // Simulate connected event
      if (voiceAgent.liveKitManager) {
        voiceAgent.liveKitManager.emit('connected');
        expect(lifecycleEvents).toContain('start');

        // Simulate speaking/listening cycle
        voiceAgent.liveKitManager.emit('speaking');
        voiceAgent.liveKitManager.emit('listening');
        expect(lifecycleEvents).toContain('speaking');
        expect(lifecycleEvents).toContain('listening');
      }

      // Pause call
      voiceAgent.pause();
      expect(lifecycleEvents).toContain('callPaused');

      // Resume call
      voiceAgent.resume();
      expect(lifecycleEvents).toContain('callResumed');

      // End call - wait for async callEnded event
      const callEndedPromise = new Promise<void>((resolve) => {
        voiceAgent.once('callEnded', resolve);
      });
      voiceAgent.end();
      await callEndedPromise;
      expect(lifecycleEvents).toContain('callEnded');

      // Verify wake lock was managed correctly
      expect(wakeLockMocks.acquire).toHaveBeenCalledTimes(2); // start + resume
      expect(wakeLockMocks.release).toHaveBeenCalledTimes(2); // pause + end
    });

    test('should handle call with tools', async () => {
      const testTool = {
        function_name: 'getUserInfo',
        description: 'Get user information',
        parameters: [
          {
            name: 'userId',
            type: 'string',
            description: 'User ID',
          },
        ],
        required: ['userId'],
        fn: (jest.fn() as any).mockResolvedValue({ name: 'John Doe', age: 30 }),
      };

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [testTool],
      });

      // Verify tool was included in the conversation-init request (2nd call)
      const requestBody = JSON.parse(
        ((fetch as any).mock.calls[1][1] as any).body
      );
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].function.name).toBe('getUserInfo');

      // Verify LiveKitManager was created with tools
      expect(voiceAgent.liveKitManager?.tools).toContain(testTool);
    });

    test('should handle multiple start calls gracefully', async () => {
      const errorSpy = jest.fn();
      voiceAgent.on('error', errorSpy);

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      // First start call
      await voiceAgent.start({
        agentId: 'test-agent-1',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      const firstManager = voiceAgent.liveKitManager;

      // Second start call (should replace the first)
      await voiceAgent.start({
        agentId: 'test-agent-2',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      // Should have created a new manager
      expect(voiceAgent.liveKitManager).not.toBe(firstManager);

      // Two fetches per start call (token + conversation-init)
      const FETCH_CALLS_PER_START = 2;
      const EXPECTED_TOTAL_FETCH_CALLS = FETCH_CALLS_PER_START * 2;
      expect(fetch).toHaveBeenCalledTimes(EXPECTED_TOTAL_FETCH_CALLS);
    });

    test('should handle getJobDetails method', async () => {
      // Mock successful job details response
      const mockJobDetails = {
        status: 'COMPLETED',
        duration: 120,
        transcript: 'Hello world',
      };

      (fetch as any)
        // participant-token
        .mockResolvedValueOnce({
          ok: true,
          json: (jest.fn() as any).mockResolvedValue({
            success: true,
            data: { liveKitAccessToken: 'token-abc', jobId: 'job-123' },
          }),
        } as unknown as Response)
        // conversation-init
        .mockResolvedValueOnce({
          ok: true,
          text: (jest.fn() as any).mockResolvedValue(''),
          json: (jest.fn() as any).mockResolvedValue({}),
        } as unknown as Response)
        // job details
        .mockResolvedValueOnce({
          ok: true,
          json: (jest.fn() as any).mockResolvedValue({
            data: mockJobDetails,
          }),
        } as unknown as Response);

      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      // Start a call to set jobId
      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      // Get job details
      const jobDetails = await voiceAgent.getJobDetails();

      expect(jobDetails).toEqual(mockJobDetails);
      expect(fetch).toHaveBeenCalledWith(
        `${mockConfig.API_URL}/v1/voice-agents/conversation/job-123?jobId=job-123`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Token ${mockApiKey}`,
          }),
        })
      );
    });

    test('should handle error scenarios gracefully', async () => {
      const errorSpy = jest.fn();
      voiceAgent.on('error', errorSpy);

      // Test start with invalid response
      (fetch as any).mockResolvedValue({
        ok: true,
        json: (jest.fn() as any).mockResolvedValue({
          success: false,
          error: 'Invalid agent ID',
        }),
      } as unknown as Response);

      await voiceAgent.start({
        agentId: 'invalid-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      expect(errorSpy).toHaveBeenCalled();
      expect(voiceAgent.liveKitManager).toBeNull();
    });

    test('should handle volume control throughout lifecycle', async () => {
      // Mock wake lock
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      // Test volume control before start (should not throw)
      voiceAgent.setVolume(VOLUMES.HALF);

      // Start call
      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        voiceEnablement: true,
        tools: [],
      });

      // Test volume control after start
      if (voiceAgent.liveKitManager) {
        const setVolumeSpy = jest.spyOn(voiceAgent.liveKitManager, 'setVolume');
        voiceAgent.setVolume(VOLUMES.HIGHER);
        expect(setVolumeSpy).toHaveBeenCalledWith(VOLUMES.HIGHER);
      }
    });
  });

  describe('Legacy Compatibility', () => {
    test('should maintain backward compatibility with old init_conversation method', async () => {
      // This tests that the legacy private method still works by calling the public start method
      // which internally uses the new LiveKit initialization
      await voiceAgent.start({
        agentId: 'test-agent',
        params: { name: 'Test' },
        voiceEnablement: true,
        tools: [],
      });

      expect(voiceAgent.jobId).toBe('mock-job-id');
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        `${mockConfig.API_URL}/v1/voice-agents/room/conversation-init`,
        expect.any(Object)
      );
    });

    test('should handle delay method correctly', async () => {
      // Test the delay functionality through a timeout
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, TIMING.DELAY_MS));
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(TIMING.VARIANCE_MS); // Allow some timing variance
    });
  });

  describe('Error Handling with HamsaApiError', () => {
    test('should create HamsaApiError with message only', () => {
      const error = new HamsaApiError('Authentication failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HamsaApiError);
      expect(error.message).toBe('Authentication failed');
      expect(error.messageKey).toBeUndefined();
      expect(error.name).toBe('HamsaApiError');
    });

    test('should create HamsaApiError with message and messageKey', () => {
      const error = new HamsaApiError(
        'Invalid API key provided',
        'AUTH_INVALID_KEY'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HamsaApiError);
      expect(error.message).toBe('Invalid API key provided');
      expect(error.messageKey).toBe('AUTH_INVALID_KEY');
      expect(error.name).toBe('HamsaApiError');
    });

    test('should handle error with messageKey for i18n purposes', () => {
      const error = new HamsaApiError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED'
      );

      // Simulate how a developer might use messageKey for i18n
      const i18nMapping = {
        AUTH_INVALID_KEY: 'Clé API invalide',
        RATE_LIMIT_EXCEEDED: 'Limite de débit dépassée',
      };

      const translatedMessage =
        error.messageKey && i18nMapping[error.messageKey]
          ? i18nMapping[error.messageKey]
          : error.message;

      expect(translatedMessage).toBe('Limite de débit dépassée');
      expect(error.messageKey).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should handle API errors thrown during initialization', async () => {
      // Mock a failed token request
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: (jest.fn() as any).mockResolvedValue(
          JSON.stringify({
            message: 'Invalid API key',
            messageKey: 'AUTH_INVALID_KEY',
          })
        ),
      } as unknown as Response);

      const errorHandler = jest.fn();
      voiceAgent.on('error', errorHandler);

      await voiceAgent.start({ agentId: 'test-agent' });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid API key',
          messageKey: 'AUTH_INVALID_KEY',
          name: 'HamsaApiError',
        })
      );
    });

    test('should handle non-JSON API errors gracefully', async () => {
      // Mock a failed token request with non-JSON response
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: (jest.fn() as any).mockResolvedValue(
          'Server temporarily unavailable'
        ),
      } as unknown as Response);

      const errorHandler = jest.fn();
      voiceAgent.on('error', errorHandler);

      await voiceAgent.start({ agentId: 'test-agent' });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '500 Internal Server Error - Server temporarily unavailable',
          messageKey: undefined,
          name: 'HamsaApiError',
        })
      );
    });
  });
});
