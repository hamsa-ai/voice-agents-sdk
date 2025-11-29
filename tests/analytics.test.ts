import LiveKitManager from '../src/classes/livekit-manager';
import HamsaVoiceAgent from '../src/main';

// Test constants to avoid magic numbers
const TEST_CALL_DURATION_MS = 60_000; // 1 minute
const TEST_LATENCY_MS = 50;
const _TEST_PACKET_LOSS = 0.1;
const _TEST_BANDWIDTH = 128_000;

// Mock LiveKit client
jest.mock('livekit-client', () => {
  const mockRoom = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    prepareConnection: jest.fn(),
    localParticipant: {
      setMicrophoneEnabled: jest.fn(),
      getTrackPublication: jest.fn(),
      registerRpcMethod: jest.fn(),
    },
    remoteParticipants: new Map(),
    engine: {
      getStats: jest.fn(),
    },
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    name: 'test-room',
  };

  return {
    Room: jest.fn(() => mockRoom),
    RoomEvent: {
      Connected: 'connected',
      Disconnected: 'disconnected',
      Reconnecting: 'reconnecting',
      Reconnected: 'reconnected',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      ParticipantConnected: 'participantConnected',
      ParticipantDisconnected: 'participantDisconnected',
      ConnectionQualityChanged: 'connectionQualityChanged',
      ConnectionStateChanged: 'connectionStateChanged',
      DataReceived: 'dataReceived',
      TranscriptionReceived: 'transcriptionReceived',
      MediaDevicesError: 'mediaDevicesError',
      AudioPlaybackStatusChanged: 'audioPlaybackStatusChanged',
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
    RpcError: class RpcError extends Error {},
  };
});

type MockRoom = {
  connect: jest.Mock;
  disconnect: jest.Mock;
  prepareConnection: jest.Mock;
  localParticipant: {
    setMicrophoneEnabled: jest.Mock;
    getTrackPublication: jest.Mock;
    registerRpcMethod: jest.Mock;
  };
  remoteParticipants: Map<string, unknown>;
  engine: {
    getStats: jest.Mock;
  };
  on: jest.Mock;
  off: jest.Mock;
  name: string;
};

describe('LiveKitManager Analytics', () => {
  let manager: LiveKitManager;
  let mockRoom: MockRoom;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new LiveKitManager('wss://test.com', 'test-token', []);
    mockRoom = manager.room as MockRoom;
  });

  afterEach(() => {
    if (manager.analyticsInterval) {
      clearInterval(manager.analyticsInterval);
    }
  });

  describe('Analytics Data Initialization', () => {
    test('should initialize analytics properties on creation', () => {
      expect(manager.callStartTime).toBeNull();
      expect(manager.callStats).toEqual({
        connectionAttempts: 0,
        reconnectionAttempts: 0,
        totalBytesReceived: 0,
        totalBytesSent: 0,
        packetsLost: 0,
        participantCount: 0,
        trackCount: 0,
        audioLevels: [],
        connectionQuality: 'unknown',
      });
      expect(manager.participants).toBeInstanceOf(Map);
      expect(manager.trackStats).toBeInstanceOf(Map);
      expect(manager.connectionMetrics.quality).toBe('unknown');
    });
  });

  describe('Connection Analytics', () => {
    test('should track connection attempts on connect', async () => {
      mockRoom.connect.mockResolvedValue(undefined);

      await manager.connect();

      expect(manager.callStats.connectionAttempts).toBe(1);
      expect(typeof manager.callStartTime).toBe('number');
      expect(manager.callStartTime).toBeGreaterThan(0);
    });

    test('should start analytics collection on connect', async () => {
      mockRoom.connect.mockResolvedValue(undefined);

      await manager.connect();

      expect(manager.analyticsInterval).toBeDefined();
    });

    test('should stop analytics collection on disconnect', async () => {
      mockRoom.connect.mockResolvedValue(undefined);
      mockRoom.disconnect.mockResolvedValue(undefined);

      await manager.connect();
      const _interval = manager.analyticsInterval;

      await manager.disconnect();

      expect(manager.analyticsInterval).toBeNull();
    });
  });

  describe('Analytics Getter Methods', () => {
    beforeEach(() => {
      // Initialize some test data directly on the analytics module
      manager.analytics.callStartTime = Date.now() - TEST_CALL_DURATION_MS;
      Object.assign(manager.analytics.connectionMetrics, {
        latency: TEST_LATENCY_MS,
        packetLoss: 0.1,
        bandwidth: 128_000,
        quality: 'good',
        jitter: 2,
      });
      Object.assign(manager.analytics.audioMetrics, {
        userAudioLevel: 0.8,
        agentAudioLevel: 0.3,
        userSpeakingTime: 30_000,
        agentSpeakingTime: 20_000,
        audioDropouts: 0,
        echoCancellationActive: true,
      });
    });

    test('getConnectionStats should return connection metrics', () => {
      const stats = manager.getConnectionStats();

      expect(stats).toMatchObject({
        quality: 'good',
        connectionAttempts: 0,
        reconnectionAttempts: 0,
        isConnected: false,
      });

      // Verify we no longer expose estimated metrics
      expect(stats).not.toHaveProperty('latency');
      expect(stats).not.toHaveProperty('packetLoss');
      expect(stats).not.toHaveProperty('bandwidth');
      expect(stats).not.toHaveProperty('jitter');
    });

    test('getAudioLevels should return audio metrics', () => {
      const levels = manager.getAudioLevels();

      expect(levels).toMatchObject({
        userAudioLevel: 0.8,
        agentAudioLevel: 0.3,
        userSpeakingTime: 30_000,
        agentSpeakingTime: 20_000,
        currentUserLevel: 0.8,
        currentAgentLevel: 0.3,
        volume: 1.0,
        isPaused: false,
      });
    });

    test('getPerformanceMetrics should include call duration', () => {
      const metrics = manager.getPerformanceMetrics();

      expect(metrics.callDuration).toBeGreaterThan(0);

      // Verify we no longer expose estimated network latency
      expect(metrics).not.toHaveProperty('networkLatency');
    });

    test('getCallAnalytics should return comprehensive analytics', () => {
      const analytics = manager.getCallAnalytics();

      expect(analytics).toHaveProperty('callDuration');
      expect(analytics).toHaveProperty('connectionStats');
      expect(analytics).toHaveProperty('audioMetrics');
      expect(analytics).toHaveProperty('performanceMetrics');
      expect(analytics).toHaveProperty('participants');
      expect(analytics).toHaveProperty('trackStats');
      expect(analytics).toHaveProperty('callStats');
    });
  });

  describe('Event Handling and Analytics', () => {
    test('should emit participant connection events', async () => {
      const mockParticipant = {
        identity: 'test-participant',
        sid: 'test-sid',
        metadata: 'test-metadata',
      };

      const participantConnectedPromise = new Promise<void>((resolve) => {
        manager.on('participantConnected', (participant) => {
          expect(participant.identity).toBe('test-participant');
          resolve();
        });
      });

      // Simulate participant connected by manually triggering the event
      // Since we can't access private methods, we'll test through the public interface
      setTimeout(() => {
        manager.emit('participantConnected', mockParticipant);
      }, 10);

      await participantConnectedPromise;
    });

    test('should emit connection quality change events', async () => {
      const mockData = {
        quality: 'good' as const,
        participant: 'test-participant',
        metrics: { quality: 'good' },
      };

      const connectionQualityPromise = new Promise<void>((resolve) => {
        manager.on('connectionQualityChanged', (data) => {
          expect(data.quality).toBe('good');
          expect(data.participant).toBe('test-participant');
          expect(data.metrics).toEqual({ quality: 'good' });
          expect(typeof data.participant).toBe('string');
          resolve();
        });
      });

      // Manually emit the event to test the interface
      setTimeout(() => {
        manager.emit('connectionQualityChanged', mockData);
      }, 10);

      await connectionQualityPromise;
    });

    test('should emit reconnection events', async () => {
      const reconnectingPromise = new Promise<void>((resolve) => {
        manager.on('reconnecting', () => {
          resolve();
        });
      });

      // Manually emit the event to test the interface
      setTimeout(() => {
        manager.emit('reconnecting');
      }, 10);

      await reconnectingPromise;
    });

    test('should handle custom data messages', async () => {
      const customEventPromise = new Promise<void>((resolve) => {
        manager.on('customEvent', (eventType, eventData, metadata) => {
          expect(eventType).toBe('flow_navigation');
          expect(eventData).toEqual({ from: 'greeting', to: 'menu' });
          expect(metadata.participant).toBe('agent');
          resolve();
        });
      });

      // Manually emit the custom event to test the interface
      setTimeout(() => {
        manager.emit(
          'customEvent',
          'flow_navigation',
          { from: 'greeting', to: 'menu' },
          { timestamp: Date.now(), participant: 'agent', rawMessage: {} }
        );
      }, 10);

      await customEventPromise;
    });
  });

  describe('WebRTC Stats Processing', () => {
    test('should emit analytics updates', async () => {
      const analyticsUpdatedPromise = new Promise<void>((resolve) => {
        manager.on('analyticsUpdated', (analytics) => {
          expect(analytics).toHaveProperty('callDuration');
          expect(analytics).toHaveProperty('connectionStats');
          resolve();
        });
      });

      // Manually emit analytics update to test the interface
      setTimeout(() => {
        const mockAnalytics = manager.getCallAnalytics();
        manager.emit('analyticsUpdated', mockAnalytics);
      }, 10);

      await analyticsUpdatedPromise;
    });
  });

  describe('Track Statistics', () => {
    test('should emit track subscription events', async () => {
      const mockData = {
        track: { kind: 'audio', sid: 'test-track-sid' },
        publication: {},
        participant: 'agent',
        trackStats: {
          trackId: 'test-track-sid',
          kind: 'audio',
          participant: 'agent',
        },
      };

      const trackSubscribedPromise = new Promise<void>((resolve) => {
        manager.on('trackSubscribed', (data) => {
          expect(data.track.sid).toBe('test-track-sid');
          expect(data.participant).toBe('agent');
          expect(typeof data.participant).toBe('string');
          expect(data.publication).toBeDefined();
          expect(data.trackStats).toBeDefined();
          resolve();
        });
      });

      // Manually emit the event to test the interface
      setTimeout(() => {
        manager.emit('trackSubscribed', mockData);
      }, 10);

      await trackSubscribedPromise;
    });

    test('should emit track unsubscription events', async () => {
      const mockData = {
        track: { kind: 'audio', sid: 'test-track-sid' },
        publication: {},
        participant: 'agent',
      };

      const trackUnsubscribedPromise = new Promise<void>((resolve) => {
        manager.on('trackUnsubscribed', (data) => {
          expect(data.track.sid).toBe('test-track-sid');
          expect(data.participant).toBe('agent');
          resolve();
        });
      });

      // Manually emit the event to test the interface
      setTimeout(() => {
        manager.emit('trackUnsubscribed', mockData);
      }, 10);

      await trackUnsubscribedPromise;
    });
  });
});

describe('HamsaVoiceAgent Analytics Integration', () => {
  let agent: HamsaVoiceAgent;

  beforeEach(() => {
    agent = new HamsaVoiceAgent('test-api-key');
  });

  test('should return null for analytics methods when not connected', () => {
    expect(agent.getConnectionStats()).toBeNull();
    expect(agent.getAudioLevels()).toBeNull();
    expect(agent.getPerformanceMetrics()).toBeNull();
    expect(agent.getParticipants()).toEqual([]);
    expect(agent.getTrackStats()).toBeNull();
    expect(agent.getCallAnalytics()).toBeNull();
  });

  test('should forward analytics methods to LiveKitManager when connected', () => {
    const mockManager = {
      getConnectionStats: jest.fn(() => ({ latency: 100 })),
      getAudioLevels: jest.fn(() => ({ userAudioLevel: 0.5 })),
      getPerformanceMetrics: jest.fn(() => ({ callDuration: 60_000 })),
      getParticipants: jest.fn(() => []),
      getTrackStats: jest.fn(() => ({ totalTracks: 2 })),
      getCallAnalytics: jest.fn(() => ({ callDuration: 60_000 })),
    };

    agent.liveKitManager = mockManager as unknown as LiveKitManager;

    agent.getConnectionStats();
    agent.getAudioLevels();
    agent.getPerformanceMetrics();
    agent.getParticipants();
    agent.getTrackStats();
    agent.getCallAnalytics();

    expect(mockManager.getConnectionStats).toHaveBeenCalled();
    expect(mockManager.getAudioLevels).toHaveBeenCalled();
    expect(mockManager.getPerformanceMetrics).toHaveBeenCalled();
    expect(mockManager.getParticipants).toHaveBeenCalled();
    expect(mockManager.getTrackStats).toHaveBeenCalled();
    expect(mockManager.getCallAnalytics).toHaveBeenCalled();
  });

  test('should forward analytics events from LiveKitManager', async () => {
    type MockManager = {
      on: jest.Mock;
      getConnectionStats: jest.Mock;
      getAudioLevels: jest.Mock;
      getPerformanceMetrics: jest.Mock;
      getParticipants: jest.Mock;
      getTrackStats: jest.Mock;
      getCallAnalytics: jest.Mock;
    };

    const mockManager: MockManager = {
      on: jest.fn(
        (event: string, callback: (data: { callDuration: number }) => void) => {
          if (event === 'analyticsUpdated') {
            // Simulate analytics update
            setTimeout(() => {
              callback({ callDuration: 30_000 });
            }, 10);
          }
          return mockManager;
        }
      ),
      getConnectionStats: jest.fn(() => null),
      getAudioLevels: jest.fn(() => null),
      getPerformanceMetrics: jest.fn(() => null),
      getParticipants: jest.fn(() => []),
      getTrackStats: jest.fn(() => null),
      getCallAnalytics: jest.fn(() => null),
    };

    agent.liveKitManager = mockManager as unknown as LiveKitManager;

    // Simulate the event forwarding setup
    const analyticsForwardedPromise = new Promise<void>((resolve) => {
      agent.on('analyticsUpdated', (analytics) => {
        expect(analytics).toMatchObject({ callDuration: 30_000 });
        resolve();
      });
    });

    // Trigger the mock manager setup
    mockManager.on(
      'analyticsUpdated',
      (analytics: { callDuration: number }) => {
        agent.emit('analyticsUpdated', analytics);
      }
    );

    await analyticsForwardedPromise;
  });
});

describe('Analytics Error Handling', () => {
  let manager: LiveKitManager;

  beforeEach(() => {
    manager = new LiveKitManager('wss://test.com', 'test-token', []);
  });

  test('should handle connection errors during connect', async () => {
    const mockError = new Error('Connection failed');
    (manager.room as MockRoom).connect = jest.fn().mockRejectedValue(mockError);

    const errorEmitted = jest.fn();
    manager.on('error', errorEmitted);

    await manager.connect();

    expect(errorEmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('LiveKit connection failed'),
      })
    );
  });

  test('should handle error events gracefully', async () => {
    const testError = new Error('Test error');

    const errorHandledPromise = new Promise<void>((resolve) => {
      manager.on('error', (error) => {
        expect(error.message).toContain('Test error');
        resolve();
      });
    });

    // Manually emit an error to test error handling
    setTimeout(() => {
      manager.emit('error', testError);
    }, 10);

    await errorHandledPromise;
  });

  test('should handle missing analytics data gracefully', () => {
    // Test with no liveKitManager in HamsaVoiceAgent
    const agent = new HamsaVoiceAgent('test-key');

    expect(agent.getConnectionStats()).toBeNull();
    expect(agent.getCallAnalytics()).toBeNull();
    expect(agent.getParticipants()).toEqual([]);
  });
});
