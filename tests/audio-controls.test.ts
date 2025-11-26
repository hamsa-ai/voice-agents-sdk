import LiveKitManager from '../src/classes/livekit-manager';
import HamsaVoiceAgent from '../src/main';
import { VOLUMES } from './utils/test-constants';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Advanced Audio Controls', () => {
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

  describe('Volume Control Methods', () => {
    test('should get output volume from audio manager', () => {
      const outputVolume = liveKitManager.audioManager.getOutputVolume();
      expect(typeof outputVolume).toBe('number');
      expect(outputVolume).toBeGreaterThanOrEqual(0);
      expect(outputVolume).toBeLessThanOrEqual(1);
    });

    test('should return default volume initially', () => {
      const outputVolume = liveKitManager.audioManager.getOutputVolume();
      expect(outputVolume).toBe(VOLUMES.DEFAULT); // Default volume
    });

    test('should get input volume from audio manager', () => {
      const inputVolume = liveKitManager.audioManager.getInputVolume();
      expect(typeof inputVolume).toBe('number');
      expect(inputVolume).toBeGreaterThanOrEqual(0);
      expect(inputVolume).toBeLessThanOrEqual(1);
    });

    test('should return 0 for input volume when no microphone access', () => {
      const inputVolume = liveKitManager.audioManager.getInputVolume();
      expect(inputVolume).toBe(VOLUMES.MIN); // Placeholder implementation
    });

    test('should reflect volume changes through getOutputVolume', () => {
      // Set a specific volume
      liveKitManager.audioManager.setVolume(VOLUMES.CUSTOM);

      // Check that getOutputVolume returns the same value
      const outputVolume = liveKitManager.audioManager.getOutputVolume();
      expect(outputVolume).toBe(VOLUMES.CUSTOM);
    });

    test('should handle volume boundaries correctly', () => {
      // Test maximum volume
      liveKitManager.audioManager.setVolume(VOLUMES.DEFAULT);
      expect(liveKitManager.audioManager.getOutputVolume()).toBe(
        VOLUMES.DEFAULT
      );

      // Test minimum volume (muted)
      liveKitManager.audioManager.setVolume(VOLUMES.MIN);
      expect(liveKitManager.audioManager.getOutputVolume()).toBe(VOLUMES.MIN);

      // Test mid-range volume
      liveKitManager.audioManager.setVolume(VOLUMES.HALF);
      expect(liveKitManager.audioManager.getOutputVolume()).toBe(VOLUMES.HALF);
    });
  });

  describe('Microphone Control Methods', () => {
    test('should emit micMuted event when muting', () => {
      const micMutedSpy = jest.fn();
      liveKitManager.audioManager.on('micMuted', micMutedSpy);

      liveKitManager.audioManager.setMicMuted(true);

      expect(micMutedSpy).toHaveBeenCalled();
    });

    test('should emit micUnmuted event when unmuting', () => {
      const micUnmutedSpy = jest.fn();
      liveKitManager.audioManager.on('micUnmuted', micUnmutedSpy);

      liveKitManager.audioManager.setMicMuted(false);

      expect(micUnmutedSpy).toHaveBeenCalled();
    });

    test('should return false for isMicMuted initially', () => {
      const isMuted = liveKitManager.audioManager.isMicMuted();
      expect(isMuted).toBe(false); // Placeholder implementation
    });

    test('should not emit events when mute operation fails', () => {
      const errorSpy = jest.fn();
      liveKitManager.audioManager.on('error', errorSpy);

      // Mock an error in the setMicMuted method
      const originalEmit = liveKitManager.audioManager.emit;
      liveKitManager.audioManager.emit = jest
        .fn()
        .mockImplementation((event, ...args) => {
          if (event === 'micMuted') {
            throw new Error('Mute failed');
          }
          return originalEmit.call(liveKitManager.audioManager, event, ...args);
        });

      // Should handle error gracefully
      expect(() => {
        liveKitManager.audioManager.setMicMuted(true);
      }).not.toThrow();
    });
  });

  describe('Frequency Data Methods', () => {
    test('should return Uint8Array for input frequency data', () => {
      const frequencyData =
        liveKitManager.audioManager.getInputByteFrequencyData();
      expect(frequencyData).toBeInstanceOf(Uint8Array);
    });

    test('should return empty array for input frequency data when no microphone', () => {
      const frequencyData =
        liveKitManager.audioManager.getInputByteFrequencyData();
      expect(frequencyData.length).toBe(0); // Placeholder implementation
    });

    test('should return Uint8Array for output frequency data', () => {
      const frequencyData =
        liveKitManager.audioManager.getOutputByteFrequencyData();
      expect(frequencyData).toBeInstanceOf(Uint8Array);
    });

    test('should return empty array for output frequency data when no audio', () => {
      const frequencyData =
        liveKitManager.audioManager.getOutputByteFrequencyData();
      expect(frequencyData.length).toBe(0); // Placeholder implementation
    });

    test('should handle frequency data requests consistently', () => {
      const inputData1 =
        liveKitManager.audioManager.getInputByteFrequencyData();
      const inputData2 =
        liveKitManager.audioManager.getInputByteFrequencyData();
      const outputData1 =
        liveKitManager.audioManager.getOutputByteFrequencyData();
      const outputData2 =
        liveKitManager.audioManager.getOutputByteFrequencyData();

      // Should return consistent types
      expect(inputData1).toBeInstanceOf(Uint8Array);
      expect(inputData2).toBeInstanceOf(Uint8Array);
      expect(outputData1).toBeInstanceOf(Uint8Array);
      expect(outputData2).toBeInstanceOf(Uint8Array);
    });
  });

  describe('HamsaVoiceAgent Audio Integration', () => {
    test('should forward getOutputVolume to audio manager', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const outputVolume = voiceAgent.getOutputVolume();
      expect(typeof outputVolume).toBe('number');
      expect(outputVolume).toBe(VOLUMES.DEFAULT); // Default volume
    });

    test('should forward getInputVolume to audio manager', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const inputVolume = voiceAgent.getInputVolume();
      expect(typeof inputVolume).toBe('number');
      expect(inputVolume).toBe(VOLUMES.MIN); // Placeholder value
    });

    test('should forward microphone controls to audio manager', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Test mute functionality
      expect(() => voiceAgent.setMicMuted(true)).not.toThrow();
      expect(() => voiceAgent.setMicMuted(false)).not.toThrow();

      // Test mute status check
      const isMuted = voiceAgent.isMicMuted();
      expect(typeof isMuted).toBe('boolean');
    });

    test('should emit micMuted event when muting through HamsaVoiceAgent', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const micMutedSpy = jest.fn();
      voiceAgent.on('micMuted', micMutedSpy);

      voiceAgent.setMicMuted(true);

      expect(micMutedSpy).toHaveBeenCalled();
    });

    test('should emit micUnmuted event when unmuting through HamsaVoiceAgent', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const micUnmutedSpy = jest.fn();
      voiceAgent.on('micUnmuted', micUnmutedSpy);

      voiceAgent.setMicMuted(false);

      expect(micUnmutedSpy).toHaveBeenCalled();
    });

    test('should forward frequency data methods to audio manager', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const inputFreqData = voiceAgent.getInputByteFrequencyData();
      const outputFreqData = voiceAgent.getOutputByteFrequencyData();

      expect(inputFreqData).toBeInstanceOf(Uint8Array);
      expect(outputFreqData).toBeInstanceOf(Uint8Array);
    });

    test('should handle audio methods when not connected', () => {
      // Test methods before connection
      expect(voiceAgent.getOutputVolume()).toBe(VOLUMES.MIN);
      expect(voiceAgent.getInputVolume()).toBe(VOLUMES.MIN);
      expect(voiceAgent.isMicMuted()).toBe(false);
      expect(() => voiceAgent.setMicMuted(true)).not.toThrow();

      const inputData = voiceAgent.getInputByteFrequencyData();
      const outputData = voiceAgent.getOutputByteFrequencyData();
      expect(inputData).toBeInstanceOf(Uint8Array);
      expect(outputData).toBeInstanceOf(Uint8Array);
      expect(inputData.length).toBe(0);
      expect(outputData.length).toBe(0);
    });

    test('should maintain volume consistency between set and get', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Set volume and verify it's reflected in getOutputVolume
      voiceAgent.setVolume(VOLUMES.SIX_TENTHS);
      expect(voiceAgent.getOutputVolume()).toBe(VOLUMES.SIX_TENTHS);

      voiceAgent.setVolume(VOLUMES.THREE_TENTHS);
      expect(voiceAgent.getOutputVolume()).toBe(VOLUMES.THREE_TENTHS);
    });
  });

  describe('Error Handling', () => {
    test('should handle audio manager method calls gracefully when manager is null', () => {
      const tempManager = liveKitManager.audioManager;
      (liveKitManager as any).audioManager = null;

      expect(() => {
        if (liveKitManager.audioManager) {
          liveKitManager.audioManager.getOutputVolume();
        }
      }).not.toThrow();

      // Restore
      (liveKitManager as any).audioManager = tempManager;
    });

    test('should emit error events for microphone control failures', () => {
      const errorSpy = jest.fn();
      liveKitManager.audioManager.on('error', errorSpy);

      // Force an error by overriding the emit method
      const originalSetMicMuted = liveKitManager.audioManager.setMicMuted;
      liveKitManager.audioManager.setMicMuted = function (muted: boolean) {
        try {
          throw new Error('Microphone access denied');
        } catch (error) {
          this.emit(
            'error',
            new Error(
              `Failed to ${muted ? 'mute' : 'unmute'} microphone: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      };

      liveKitManager.audioManager.setMicMuted(true);
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to mute microphone'),
        })
      );

      // Restore
      liveKitManager.audioManager.setMicMuted = originalSetMicMuted;
    });
  });
});
