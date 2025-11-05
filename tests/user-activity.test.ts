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

// Helper to check if console.log was called with a message from the debug logger
const expectLoggerCalledWith = (message: string, context?: any) => {
  // The logger calls console.log(formattedMessage, message, errorObject)
  // We check if any call matches our expected message
  const calls = consoleSpy.mock.calls;
  const matchingCall = calls.find(
    (call) => call[1] === message && (!context || call[2]?.context === context)
  );
  // biome-ignore lint/suspicious/noMisplacedAssertion: This is a test helper function
  expect(matchingCall).toBeDefined();
};

// Helper to count specific log messages
const countLoggerCalls = (message: string): number => {
  const calls = consoleSpy.mock.calls;
  return calls.filter((call) => call[1] === message).length;
};

describe('User Activity and Contextual Updates', () => {
  let voiceAgent: HamsaVoiceAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
    // Enable debug mode so the logger outputs to console
    voiceAgent = new HamsaVoiceAgent('test-api-key', { debug: true });

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

      expectLoggerCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });

    test('should not log when not connected', () => {
      voiceAgent.sendUserActivity();

      // Logger won't be called if not connected
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should handle multiple rapid calls', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Call multiple times rapidly
      for (let i = 0; i < RAPID_CALLS_COUNT; i++) {
        voiceAgent.sendUserActivity();
      }

      const callCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      expect(callCount).toBe(RAPID_CALLS_COUNT);
      expectLoggerCalledWith(
        'User activity detected - preventing agent interruption'
      );
    });

    test('should work correctly after disconnection and reconnection', async () => {
      // Initial connection
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendUserActivity();
      const initialCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      expect(initialCount).toBe(1);

      // End and restart
      await voiceAgent.end();
      consoleSpy.mockClear();

      voiceAgent.sendUserActivity();
      expect(consoleSpy).not.toHaveBeenCalled(); // Should not log when disconnected

      // Reconnect
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendUserActivity();
      expectLoggerCalledWith(
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

      expectLoggerCalledWith('Sending contextual update', contextMessage);
    });

    test('should not log when not connected', () => {
      const contextMessage = 'User navigated to checkout page';
      voiceAgent.sendContextualUpdate(contextMessage);

      expect(consoleSpy).not.toHaveBeenCalled();
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

      const callCount = countLoggerCalls('Sending contextual update');
      expect(callCount).toBe(contexts.length);
      for (const context of contexts) {
        expectLoggerCalledWith('Sending contextual update', context);
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

      const callCount = countLoggerCalls('Sending contextual update');
      expect(callCount).toBe(specialContexts.length);
    });

    test('should work correctly after disconnection and reconnection', async () => {
      // Initial connection
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendContextualUpdate('Initial context');
      const initialCount = countLoggerCalls('Sending contextual update');
      expect(initialCount).toBe(1);

      // End and restart
      await voiceAgent.end();
      consoleSpy.mockClear();

      voiceAgent.sendContextualUpdate('Context while disconnected');
      expect(consoleSpy).not.toHaveBeenCalled(); // Should not log when disconnected

      // Reconnect
      await voiceAgent.start({ agentId: 'test-agent' });
      voiceAgent.sendContextualUpdate('Context after reconnection');
      expectLoggerCalledWith(
        'Sending contextual update',
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

      const activityCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      const contextCount = countLoggerCalls('Sending contextual update');
      expect(activityCount + contextCount).toBe(EXPECTED_INTEGRATION_CALLS);

      expectLoggerCalledWith(
        'User activity detected - preventing agent interruption'
      );
      expectLoggerCalledWith(
        'Sending contextual update',
        'User clicked button'
      );
      expectLoggerCalledWith(
        'Sending contextual update',
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

      const activityCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      const contextCount = countLoggerCalls('Sending contextual update');
      expect(activityCount + contextCount).toBe(EXPECTED_MAINTAIN_STATE_CALLS);

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

      const activityCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      const contextCount = countLoggerCalls('Sending contextual update');
      expect(activityCount + contextCount).toBe(RAPID_MIXED_CALLS);

      // Verify no errors occurred
      expectLoggerCalledWith(
        'User activity detected - preventing agent interruption'
      );
      expectLoggerCalledWith('Sending contextual update', 'Context update 19');
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
      const newAgent = new HamsaVoiceAgent('test-key', { debug: true });

      expect(() => newAgent.sendUserActivity()).not.toThrow();
      expect(() => newAgent.sendContextualUpdate('test')).not.toThrow();

      // Should not log anything (because not connected, not because debug is off)
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should handle isConnected state changes correctly', async () => {
      await voiceAgent.start({ agentId: 'test-agent' });

      // Should work when connected
      voiceAgent.sendUserActivity();
      const activityCount = countLoggerCalls(
        'User activity detected - preventing agent interruption'
      );
      expect(activityCount).toBe(1);

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
