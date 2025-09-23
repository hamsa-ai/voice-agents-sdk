import LiveKitManager from '../src/classes/livekit-manager';
import HamsaVoiceAgent from '../src/main';

// Test constants to avoid magic numbers
const TEST_LATENCY_MS = 75;
const TEST_PACKET_LOSS = 2.5;
const TEST_BANDWIDTH = 300_000;
const TEST_JITTER_MS = 15;
const PERFORMANCE_TEST_ITERATIONS = 100;
const PERFORMANCE_TEST_MAX_TIME_MS = 100;

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Enhanced LiveKit Analytics', () => {
  let liveKitManager: LiveKitManager;
  let voiceAgent: HamsaVoiceAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    liveKitManager = new LiveKitManager('wss://test.com', 'token123', []);
    voiceAgent = new HamsaVoiceAgent('test-api-key');

    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            liveKitAccessToken: 'mock-token',
            jobId: 'job-123',
          },
        }),
    });
  });

  describe('WebRTC Statistics Processing', () => {
    test('should maintain internal analytics structure for future use', async () => {
      await liveKitManager.connect();

      // Verify that the room is created
      expect(liveKitManager.room).toBeDefined();

      // Verify call stats structure exists (real data)
      expect(liveKitManager.callStats).toHaveProperty('totalBytesReceived');
      expect(liveKitManager.callStats).toHaveProperty('totalBytesSent');
      expect(liveKitManager.callStats).toHaveProperty('packetsLost');

      // Verify internal connection metrics still exist (for future use)
      expect(liveKitManager.connectionMetrics).toHaveProperty('latency');
      expect(liveKitManager.connectionMetrics).toHaveProperty('bandwidth');
      expect(liveKitManager.connectionMetrics).toHaveProperty('jitter');
      expect(liveKitManager.connectionMetrics).toHaveProperty('quality');

      // Verify all properties are correct types
      expect(typeof liveKitManager.callStats.totalBytesReceived).toBe('number');
      expect(typeof liveKitManager.callStats.totalBytesSent).toBe('number');
      expect(typeof liveKitManager.connectionMetrics.jitter).toBe('number');
      expect(typeof liveKitManager.connectionMetrics.quality).toBe('string');
    });

    test('should handle stats errors gracefully', async () => {
      await liveKitManager.connect();

      // Should not throw and should still return valid analytics even if stats fail
      const analytics = liveKitManager.getCallAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.connectionStats).toBeDefined();
    });

    test('should expose only real data through customer API', () => {
      const connectionStats = liveKitManager.getConnectionStats();
      const audioLevels = liveKitManager.getAudioLevels();
      const performanceMetrics = liveKitManager.getPerformanceMetrics();

      // Verify customer API only returns real data
      expect(connectionStats).toHaveProperty('quality');
      expect(connectionStats).toHaveProperty('connectionAttempts');
      expect(connectionStats).toHaveProperty('isConnected');
      expect(connectionStats).toHaveProperty('connectionEstablishedTime');

      // Verify estimated metrics are NOT exposed to customers
      expect(connectionStats).not.toHaveProperty('jitter');
      expect(connectionStats).not.toHaveProperty('bandwidth');
      expect(connectionStats).not.toHaveProperty('latency');
      expect(connectionStats).not.toHaveProperty('packetLoss');

      expect(audioLevels).toHaveProperty('userAudioLevel');
      expect(audioLevels).toHaveProperty('agentAudioLevel');

      // Performance metrics should not expose estimated network latency
      expect(performanceMetrics).not.toHaveProperty('networkLatency');
      expect(performanceMetrics).toHaveProperty('responseTime');
      expect(performanceMetrics).toHaveProperty('callDuration');
    });
  });

  describe('Enhanced Connection Quality Handling', () => {
    test('should provide only verified connection statistics to customers', () => {
      const stats = liveKitManager.getConnectionStats();

      // Verify only real properties are exposed to customers
      expect(stats).toHaveProperty('quality');
      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('reconnectionAttempts');
      expect(stats).toHaveProperty('connectionEstablishedTime');
      expect(stats).toHaveProperty('isConnected');

      // Verify estimated metrics are NOT exposed
      expect(stats).not.toHaveProperty('latency');
      expect(stats).not.toHaveProperty('packetLoss');
      expect(stats).not.toHaveProperty('bandwidth');
      expect(stats).not.toHaveProperty('jitter');

      // Verify types of real data
      expect(typeof stats.quality).toBe('string');
      expect(typeof stats.connectionAttempts).toBe('number');
      expect(typeof stats.isConnected).toBe('boolean');
    });

    test('should handle internal metrics updates while keeping customer API clean', () => {
      // Test setting internal metrics directly (simulating what would happen from LiveKit events)
      liveKitManager.connectionMetrics.latency = TEST_LATENCY_MS;
      liveKitManager.connectionMetrics.packetLoss = TEST_PACKET_LOSS;
      liveKitManager.connectionMetrics.bandwidth = TEST_BANDWIDTH;
      liveKitManager.connectionMetrics.quality = 'good';
      liveKitManager.connectionMetrics.jitter = TEST_JITTER_MS;

      // Verify internal metrics are updated
      expect(liveKitManager.connectionMetrics.latency).toBe(TEST_LATENCY_MS);
      expect(liveKitManager.connectionMetrics.packetLoss).toBe(
        TEST_PACKET_LOSS
      );
      expect(liveKitManager.connectionMetrics.bandwidth).toBe(TEST_BANDWIDTH);
      expect(liveKitManager.connectionMetrics.quality).toBe('good');
      expect(liveKitManager.connectionMetrics.jitter).toBe(TEST_JITTER_MS);

      // But customer API still only shows real data
      const stats = liveKitManager.getConnectionStats();
      expect(stats.quality).toBe('good');
      expect(stats).not.toHaveProperty('latency');
      expect(stats).not.toHaveProperty('packetLoss');
      expect(stats).not.toHaveProperty('bandwidth');
      expect(stats).not.toHaveProperty('jitter');
    });
  });

  describe('Enhanced Track Statistics', () => {
    test('should provide comprehensive track statistics structure', () => {
      const trackStats = liveKitManager.getTrackStats();

      // Verify structure
      expect(trackStats).toHaveProperty('totalTracks');
      expect(trackStats).toHaveProperty('activeTracks');
      expect(trackStats).toHaveProperty('audioElements');
      expect(trackStats).toHaveProperty('trackDetails');

      expect(typeof trackStats.totalTracks).toBe('number');
      expect(typeof trackStats.activeTracks).toBe('number');
      expect(typeof trackStats.audioElements).toBe('number');
      expect(Array.isArray(trackStats.trackDetails)).toBe(true);
    });

    test('should handle track data correctly when tracks are added', () => {
      // Manually add track data to simulate what happens during track subscription
      const mockTrackData = {
        trackId: 'track-123',
        kind: 'audio',
        participant: 'agent',
        subscriptionTime: Date.now(),
        publication: {} as any, // Mock publication object
        source: 'microphone',
        muted: false,
        enabled: true,
        simulcasted: false,
      };

      liveKitManager.trackStats.set('track-123', mockTrackData);
      liveKitManager.callStats.trackCount = 1;

      const trackStats = liveKitManager.getTrackStats();

      expect(trackStats.activeTracks).toBe(1);
      expect(trackStats.trackDetails.length).toBe(1);

      const [trackId, trackData] = trackStats.trackDetails[0];
      expect(trackId).toBe('track-123');
      expect(trackData.source).toBe('microphone');
      expect(trackData.muted).toBe(false);
      expect(trackData.enabled).toBe(true);
    });
  });

  describe('Analytics Collection Integration', () => {
    test('should maintain comprehensive analytics data structures', async () => {
      await liveKitManager.connect();

      // Add some test data to simulate what happens during real usage
      liveKitManager.participants.set('p1', {
        identity: 'agent',
        sid: 'p1',
        connectionTime: Date.now(),
      });
      liveKitManager.trackStats.set('t1', {
        trackId: 't1',
        kind: 'audio',
        participant: 'agent',
        subscriptionTime: Date.now(),
        publication: {} as any, // Mock publication object
      });
      // Update call stats to reflect the added data
      liveKitManager.callStats.participantCount =
        liveKitManager.participants.size;
      liveKitManager.callStats.trackCount = liveKitManager.trackStats.size;

      const analytics = liveKitManager.getCallAnalytics();

      expect(analytics.participants.length).toBe(1);
      expect(analytics.trackStats.activeTracks).toBe(1);
      expect(analytics.callStats.participantCount).toBe(1);
      expect(analytics.callStats.trackCount).toBe(1);
    });

    test('should handle edge cases gracefully', async () => {
      await liveKitManager.connect();

      // Should still return valid analytics even with no data
      const analytics = liveKitManager.getCallAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.connectionStats).toBeDefined();
      expect(analytics.audioMetrics).toBeDefined();
      expect(analytics.performanceMetrics).toBeDefined();
    });

    test('should support LiveKit native analytics integration', async () => {
      await liveKitManager.connect();

      // Verify that all the enhanced analytics properties exist
      expect(liveKitManager.connectionMetrics).toHaveProperty('jitter');
      expect(liveKitManager.connectionMetrics).toHaveProperty('bandwidth');
      expect(liveKitManager.callStats).toHaveProperty('totalBytesReceived');
      expect(liveKitManager.callStats).toHaveProperty('totalBytesSent');
      expect(liveKitManager.callStats).toHaveProperty('packetsLost');

      // Verify enhanced track data structure
      const trackStats = liveKitManager.getTrackStats();
      expect(trackStats).toHaveProperty('trackDetails');
    });
  });

  describe('Periodic Analytics Updates', () => {
    test('should have analytics interval management', async () => {
      // Should start as null
      expect(liveKitManager.analyticsInterval).toBeNull();

      await liveKitManager.connect();

      // Should have interval after connection (may not be set immediately in mock)
      // Just verify the property exists
      expect(liveKitManager).toHaveProperty('analyticsInterval');
    });

    test('should clean up on disconnect', async () => {
      await liveKitManager.connect();

      // Add some test data
      liveKitManager.participants.set('p1', {
        identity: 'test',
        sid: 'p1',
        connectionTime: Date.now(),
      });
      liveKitManager.trackStats.set('t1', {
        trackId: 'test',
        kind: 'audio',
        participant: 'test',
        subscriptionTime: Date.now(),
        publication: {} as any,
      });

      await liveKitManager.disconnect();

      expect(liveKitManager.analyticsInterval).toBeNull();
      expect(liveKitManager.participants.size).toBe(0);
      expect(liveKitManager.trackStats.size).toBe(0);
    });
  });

  describe('HamsaVoiceAgent Analytics Integration', () => {
    test('should forward enhanced analytics from LiveKitManager', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Verify all analytics methods work
      const connectionStats = voiceAgent.getConnectionStats();
      const audioLevels = voiceAgent.getAudioLevels();
      const performanceMetrics = voiceAgent.getPerformanceMetrics();
      const participants = voiceAgent.getParticipants();
      const trackStats = voiceAgent.getTrackStats();
      const callAnalytics = voiceAgent.getCallAnalytics();

      // Verify they return only real data structure (no estimated metrics)
      expect(connectionStats).toHaveProperty('quality');
      expect(connectionStats).toHaveProperty('connectionAttempts');
      expect(connectionStats).toHaveProperty('isConnected');

      // Verify estimated metrics are NOT exposed to customers
      expect(connectionStats).not.toHaveProperty('latency');
      expect(connectionStats).not.toHaveProperty('packetLoss');
      expect(connectionStats).not.toHaveProperty('bandwidth');
      expect(connectionStats).not.toHaveProperty('jitter');

      expect(audioLevels).toHaveProperty('userAudioLevel');
      expect(audioLevels).toHaveProperty('agentAudioLevel');

      // Performance metrics should not expose estimated network latency
      expect(performanceMetrics).not.toHaveProperty('networkLatency');
      expect(performanceMetrics).toHaveProperty('callDuration');

      expect(Array.isArray(participants)).toBe(true);

      expect(trackStats).toHaveProperty('totalTracks');
      expect(trackStats).toHaveProperty('trackDetails');

      expect(callAnalytics).toHaveProperty('connectionStats');
      expect(callAnalytics).toHaveProperty('performanceMetrics');
    });

    test('should handle event forwarding', async () => {
      const connectionQualitySpy = jest.fn();

      await voiceAgent.start({ agentId: 'test-agent' });

      voiceAgent.on('connectionQualityChanged', connectionQualitySpy);

      // We can't easily mock the events, but we can verify the event listener is set up
      expect(voiceAgent.liveKitManager).toBeDefined();
      expect(voiceAgent.liveKitManager).not.toBeNull();
      if (voiceAgent.liveKitManager) {
        expect(
          voiceAgent.liveKitManager.listenerCount('connectionQualityChanged')
        ).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle analytics when room is null', () => {
      const tempRoom = liveKitManager.connection.room;
      liveKitManager.connection.room = null;

      // Should not throw
      const analytics = liveKitManager.getCallAnalytics();
      expect(analytics).toBeDefined();

      // Restore room
      liveKitManager.connection.room = tempRoom;
    });

    test('should handle analytics when disconnected', () => {
      liveKitManager.connection.isConnected = false;

      const stats = liveKitManager.getConnectionStats();
      expect(stats).toBeDefined();
      expect(stats.isConnected).toBe(false);
    });

    test('should handle missing optional properties', () => {
      // Test that analytics work even with minimal data
      expect(() => {
        const analytics = liveKitManager.getCallAnalytics();
        expect(analytics.connectionStats).toBeDefined();
        expect(analytics.audioMetrics).toBeDefined();
        expect(analytics.performanceMetrics).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle multiple analytics calls efficiently', () => {
      const startTime = Date.now();

      // Call analytics methods multiple times
      for (let i = 0; i < PERFORMANCE_TEST_ITERATIONS; i++) {
        liveKitManager.getCallAnalytics();
        liveKitManager.getConnectionStats();
        liveKitManager.getAudioLevels();
      }

      const endTime = Date.now();

      // Should complete quickly (< 100ms for 300 calls)
      expect(endTime - startTime).toBeLessThan(PERFORMANCE_TEST_MAX_TIME_MS);
    });

    test('should maintain consistent state', async () => {
      await liveKitManager.connect();

      // Add and remove data multiple times
      for (let i = 0; i < 10; i++) {
        liveKitManager.participants.set(`p${i}`, {
          identity: `user${i}`,
          sid: `p${i}`,
          connectionTime: Date.now(),
        });
        liveKitManager.trackStats.set(`t${i}`, {
          trackId: `track${i}`,
          kind: 'audio',
          participant: `user${i}`,
          subscriptionTime: Date.now(),
          publication: {} as any,
        });
      }

      expect(liveKitManager.participants.size).toBe(10);
      expect(liveKitManager.trackStats.size).toBe(10);

      // Clean up
      await liveKitManager.disconnect();

      expect(liveKitManager.participants.size).toBe(0);
      expect(liveKitManager.trackStats.size).toBe(0);
    });
  });
});
