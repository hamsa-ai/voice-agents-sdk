import HamsaVoiceAgent from '../src/main';

// Mock fetch for API calls
global.fetch = jest.fn();

// Magic numbers used in this suite
const RAPID_CALLS_COUNT = 5;
const EXPECTED_INTEGRATION_CALLS = 5;
const EXPECTED_MAINTAIN_STATE_CALLS = 6;
const RAPID_MIXED_CALLS = 20;
const NON_STRING_NUMBER = 123;

// Mock console.log to test log outputs
const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

describe('User Activity and Contextual Updates', () => {
  let voiceAgent: HamsaVoiceAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
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

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('sendUserActivity Method', () => {
    test('should not throw when called before connection', () => {
      expect(() => voiceAgent.sendUserActivity()).not.toThrow();
    });

    test('should log user activity when connected', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      voiceAgent.sendUserActivity();

      expect(consoleSpy).toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });

    test('should not log when not connected', () => {
      voiceAgent.sendUserActivity();

      expect(consoleSpy).not.toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });

    test('should handle multiple rapid calls', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Call multiple times rapidly
      for (let i = 0; i < RAPID_CALLS_COUNT; i++) {
        voiceAgent.sendUserActivity();
      }

      expect(consoleSpy).toHaveBeenCalledTimes(RAPID_CALLS_COUNT + 3); // +1 for SDK init, +2 for connect logs
      expect(consoleSpy).toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });

    test('should work correctly after disconnection and reconnection', async () => {
      // Initial connection
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendUserActivity();
      expect(consoleSpy).toHaveBeenCalledTimes(4); // SDK init + connect logs + user activity

      // End and restart
      await voiceAgent.end();
      consoleSpy.mockClear();

      voiceAgent.sendUserActivity();
      expect(consoleSpy).not.toHaveBeenCalled(); // Should not log when disconnected

      // Reconnect
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendUserActivity();
      expect(consoleSpy).toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });
  });

  describe('sendContextualUpdate Method', () => {
    test('should not throw when called before connection', () => {
      expect(() =>
        voiceAgent.sendContextualUpdate('test context')
      ).not.toThrow();
    });

    test('should log contextual update when connected', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const contextMessage = 'User navigated to checkout page';
      voiceAgent.sendContextualUpdate(contextMessage);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending contextual update:',
        contextMessage
      );
    });

    test('should not log when not connected', () => {
      const contextMessage = 'User navigated to checkout page';
      voiceAgent.sendContextualUpdate(contextMessage);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        'Sending contextual update:',
        contextMessage
      );
    });

    test('should handle different types of contextual messages', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const contexts = [
        'User navigated to checkout page',
        'Shopping cart total: $127.50',
        'User selected premium plan',
        'Page load time: 1.2s',
        'User clicked help button',
      ];

      for (const context of contexts) {
        voiceAgent.sendContextualUpdate(context);
      }

      expect(consoleSpy).toHaveBeenCalledTimes(contexts.length + 3); // +1 for SDK init, +2 for connect logs
      for (const context of contexts) {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Sending contextual update:',
          context
        );
      }
    });

    test('should handle empty and special characters in context', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      const specialContexts = [
        '',
        'Context with "quotes" and symbols: $, &, %',
        'Unicode context: 🛒 💰 ✅',
        'Multi-line\ncontext\nwith\nnewlines',
        'Very long context that contains multiple pieces of information about the user state, navigation history, cart contents, preferences, and other relevant details that might influence the agent behavior',
      ];

      for (const context of specialContexts) {
        expect(() => voiceAgent.sendContextualUpdate(context)).not.toThrow();
      }

      expect(consoleSpy).toHaveBeenCalledTimes(specialContexts.length + 3); // +1 for SDK init, +2 for connect logs
    });

    test('should work correctly after disconnection and reconnection', async () => {
      // Initial connection
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendContextualUpdate('Initial context');
      expect(consoleSpy).toHaveBeenCalledTimes(4); // SDK init + connect logs + contextual update

      // End and restart
      await voiceAgent.end();
      consoleSpy.mockClear();

      voiceAgent.sendContextualUpdate('Context while disconnected');
      expect(consoleSpy).not.toHaveBeenCalled(); // Should not log when disconnected

      // Reconnect
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendContextualUpdate('Context after reconnection');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending contextual update:',
        'Context after reconnection'
      );
    });
  });

  describe('Integration Tests', () => {
    test('should handle both user activity and contextual updates together', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Mix of user activity and contextual updates
      voiceAgent.sendUserActivity();
      voiceAgent.sendContextualUpdate('User clicked button');
      voiceAgent.sendUserActivity();
      voiceAgent.sendContextualUpdate('User scrolled to bottom');
      voiceAgent.sendUserActivity();

      expect(consoleSpy).toHaveBeenCalledTimes(EXPECTED_INTEGRATION_CALLS + 3); // +1 for SDK init, +2 for connect logs
      expect(consoleSpy).toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending contextual update:',
        'User clicked button'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending contextual update:',
        'User scrolled to bottom'
      );
    });

    test('should maintain state correctly across multiple operations', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Simulate a typical user interaction flow
      voiceAgent.sendUserActivity(); // User starts typing
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      voiceAgent.sendContextualUpdate('User is typing in search field');
      await new Promise((resolve) => setTimeout(resolve, 10));

      voiceAgent.sendUserActivity(); // User continues typing
      voiceAgent.sendContextualUpdate('Search suggestions appeared');
      voiceAgent.sendUserActivity(); // User selects suggestion
      voiceAgent.sendContextualUpdate('User selected "premium plan"');

      expect(consoleSpy).toHaveBeenCalledTimes(
        EXPECTED_MAINTAIN_STATE_CALLS + 3
      ); // +1 for SDK init, +2 for connect logs

      // Verify the methods don't interfere with each other
      expect(() => {
        voiceAgent.sendUserActivity();
        voiceAgent.sendContextualUpdate('Final update');
      }).not.toThrow();
    });

    test('should handle rapid successive calls without issues', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Rapid fire both types of calls
      for (let i = 0; i < RAPID_MIXED_CALLS; i++) {
        if (i % 2 === 0) {
          voiceAgent.sendUserActivity();
        } else {
          voiceAgent.sendContextualUpdate(`Context update ${i}`);
        }
      }

      expect(consoleSpy).toHaveBeenCalledTimes(RAPID_MIXED_CALLS + 3); // +1 for SDK init, +2 for connect logs

      // Verify no errors occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        'User activity detected - preventing agent interruption'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending contextual update:',
        'Context update 19'
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null/undefined context gracefully', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      expect(() => voiceAgent.sendContextualUpdate(null as any)).not.toThrow();
      expect(() =>
        voiceAgent.sendContextualUpdate(undefined as any)
      ).not.toThrow();
    });

    test('should handle non-string context values', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      expect(() =>
        voiceAgent.sendContextualUpdate(NON_STRING_NUMBER as any)
      ).not.toThrow();
      expect(() =>
        voiceAgent.sendContextualUpdate({ key: 'value' } as any)
      ).not.toThrow();
      expect(() =>
        voiceAgent.sendContextualUpdate(['array', 'context'] as any)
      ).not.toThrow();
    });

    test('should handle methods when liveKitManager is null', () => {
      // Test before any connection is established
      const newAgent = new HamsaVoiceAgent('test-key');

      expect(() => newAgent.sendUserActivity()).not.toThrow();
      expect(() => newAgent.sendContextualUpdate('test')).not.toThrow();

      // Should not log anything
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should handle isConnected state changes correctly', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Should work when connected
      voiceAgent.sendUserActivity();
      expect(consoleSpy).toHaveBeenCalledTimes(4); // SDK init + connect logs + user activity

      // Simulate connection loss
      if (voiceAgent.liveKitManager) {
        voiceAgent.liveKitManager.connection.isConnected = false;
      }

      consoleSpy.mockClear();
      voiceAgent.sendUserActivity();
      voiceAgent.sendContextualUpdate('test context');

      // Should not log when not connected
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
