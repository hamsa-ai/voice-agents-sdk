import HamsaVoiceAgent from '../src/main';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('StartOptions - New Parameters', () => {
  let voiceAgent: HamsaVoiceAgent;

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('userId Parameter', () => {
    test('should accept userId parameter without errors', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: 'user-12345',
        })
      ).resolves.not.toThrow();
    });

    test('should accept different userId formats', async () => {
      const userIds = [
        'user-123',
        'customer_456789',
        'guest-session-abc-def',
        '12345',
        'user@example.com',
        'uuid-4a4e8b3c-6f2d-4c8a-9b1e-3f4d5e6f7g8h',
      ];

      for (const userId of userIds) {
        await expect(
          voiceAgent.start({
            agentId: 'test-agent',
            userId,
          })
        ).resolves.not.toThrow();

        await voiceAgent.end();
      }
    });

    test('should work without userId parameter (optional)', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should handle empty or null userId', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: '',
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: undefined,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('preferHeadphonesForIosDevices Parameter', () => {
    test('should accept preferHeadphonesForIosDevices as boolean', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          preferHeadphonesForIosDevices: true,
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          preferHeadphonesForIosDevices: false,
        })
      ).resolves.not.toThrow();
    });

    test('should default to false when not specified', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should work with other parameters combined', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: 'user-123',
          voiceEnablement: true,
          preferHeadphonesForIosDevices: true,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('connectionDelay Parameter', () => {
    test('should accept connectionDelay with all platform values', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            android: 3000,
            ios: 500,
            default: 1000,
          },
        })
      ).resolves.not.toThrow();
    });

    test('should accept partial connectionDelay values', async () => {
      // Only Android delay
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            android: 2000,
          },
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      // Only iOS delay
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            ios: 800,
          },
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      // Only default delay
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            default: 1500,
          },
        })
      ).resolves.not.toThrow();
    });

    test('should accept zero delays', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            android: 0,
            ios: 0,
            default: 0,
          },
        })
      ).resolves.not.toThrow();
    });

    test('should handle empty connectionDelay object', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {},
        })
      ).resolves.not.toThrow();
    });

    test('should work without connectionDelay parameter', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should accept various delay values', async () => {
      const delays = [
        { android: 100, ios: 50, default: 200 },
        { android: 5000 }, // High delay for Android
        { ios: 1 }, // Minimal delay for iOS
        { default: 10_000 }, // Very high default delay
      ];

      for (const delay of delays) {
        await expect(
          voiceAgent.start({
            agentId: 'test-agent',
            connectionDelay: delay,
          })
        ).resolves.not.toThrow();

        await voiceAgent.end();
      }
    });
  });

  describe('disableWakeLock Parameter', () => {
    test('should accept disableWakeLock as boolean', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          disableWakeLock: true,
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          disableWakeLock: false,
        })
      ).resolves.not.toThrow();
    });

    test('should default to false when not specified', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should work with voice enablement and wake lock settings', async () => {
      // Voice enabled, wake lock disabled (e.g., for battery saving)
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          voiceEnablement: true,
          disableWakeLock: true,
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      // Voice disabled, wake lock enabled (text-only but keep screen on)
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          voiceEnablement: false,
          disableWakeLock: false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('avatarContainerSelector Parameter', () => {
    test('should accept avatarContainerSelector as a CSS selector string', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          avatarContainerSelector: '#avatar-container',
        })
      ).resolves.not.toThrow();
    });

    test('should work without avatarContainerSelector (optional)', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should accept various valid CSS selector formats', async () => {
      const selectors = [
        '#avatar-container',
        '.agent-video-wrapper',
        '[data-testid="avatar"]',
        'div.video-container',
      ];

      for (const avatarContainerSelector of selectors) {
        await expect(
          voiceAgent.start({ agentId: 'test-agent', avatarContainerSelector })
        ).resolves.not.toThrow();
        await voiceAgent.end();
      }
    });
  });

  describe('Combined Parameters', () => {
    test('should accept all new parameters together', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          params: { userName: 'John', sessionId: '123' },
          voiceEnablement: true,
          tools: [],
          userId: 'user-john-123',
          preferHeadphonesForIosDevices: true,
          connectionDelay: {
            android: 3000,
            ios: 500,
            default: 1000,
          },
          disableWakeLock: false,
          avatarContainerSelector: '#avatar',
        })
      ).resolves.not.toThrow();
    });

    test('should work with various parameter combinations', async () => {
      const combinations = [
        {
          agentId: 'test-agent',
          userId: 'user-1',
          preferHeadphonesForIosDevices: true,
        },
        {
          agentId: 'test-agent',
          connectionDelay: { android: 2000 },
          disableWakeLock: true,
        },
        {
          agentId: 'test-agent',
          voiceEnablement: true,
          userId: 'user-2',
          connectionDelay: { ios: 300, default: 800 },
        },
        {
          agentId: 'test-agent',
          params: { mode: 'advanced' },
          userId: 'power-user',
          preferHeadphonesForIosDevices: false,
          disableWakeLock: false,
        },
      ];

      for (const [_index, options] of combinations.entries()) {
        await expect(voiceAgent.start(options)).resolves.not.toThrow();
        await voiceAgent.end();
      }
    });

    test('should maintain backward compatibility with existing parameters', async () => {
      // Legacy call should still work
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          params: { legacy: 'param' },
          voiceEnablement: true,
          tools: [],
        })
      ).resolves.not.toThrow();
    });

    test('should work with minimal required parameters', async () => {
      // Only agentId should be sufficient
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
        })
      ).resolves.not.toThrow();
    });

    test('should handle parameter type validation implicitly', async () => {
      // TypeScript should catch these at compile time, but test runtime behavior
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: 'valid-user',
          preferHeadphonesForIosDevices: true,
          connectionDelay: {
            android: 1000,
            ios: 500,
            default: 750,
          },
          disableWakeLock: false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme delay values gracefully', async () => {
      // Very high delays
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            android: 999_999,
            ios: 999_999,
            default: 999_999,
          },
        })
      ).resolves.not.toThrow();

      await voiceAgent.end();

      // Negative delays (should be handled gracefully)
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          connectionDelay: {
            android: -1000,
            ios: -500,
            default: -100,
          },
        })
      ).resolves.not.toThrow();
    });

    test('should handle special userId values', async () => {
      const specialUserIds = [
        'user with spaces',
        'user-with-unicode-🎯',
        'very-long-user-id-that-contains-many-characters-and-might-be-problematic-in-some-systems-but-should-still-work',
        '123456789',
        'user@domain.com',
        'user/with/slashes',
        'user\\with\\backslashes',
      ];

      for (const userId of specialUserIds) {
        await expect(
          voiceAgent.start({
            agentId: 'test-agent',
            userId,
          })
        ).resolves.not.toThrow();

        await voiceAgent.end();
      }
    });

    test('should handle undefined/null new parameters gracefully', async () => {
      await expect(
        voiceAgent.start({
          agentId: 'test-agent',
          userId: undefined,
          preferHeadphonesForIosDevices: undefined as any,
          connectionDelay: undefined,
          disableWakeLock: undefined as any,
        })
      ).resolves.not.toThrow();
    });
  });
});

describe('versionRef Parameter', () => {
  let voiceAgent: HamsaVoiceAgent;

  /** Bodies posted to the two endpoints that resolve the agent. */
  const postedBodies = () =>
    (global.fetch as any).mock.calls.map(([, init]: [string, RequestInit]) =>
      JSON.parse(String(init.body))
    );

  beforeEach(() => {
    jest.clearAllMocks();
    voiceAgent = new HamsaVoiceAgent('test-api-key');

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { liveKitAccessToken: 'mock-token', jobId: 'job-123' },
        }),
    });
  });

  test('sends nothing on the wire when it is not given', async () => {
    // The safety property. Every caller that exists today omits this, so their
    // requests have to stay byte-identical: a backend that rejects unknown
    // fields must not start seeing one.
    await voiceAgent.start({ agentId: 'test-agent' });

    for (const body of postedBodies()) {
      expect(body).not.toHaveProperty('versionRef');
    }
  });

  test('forwards a published version id to both endpoints', async () => {
    await voiceAgent.start({ agentId: 'test-agent', versionRef: 'ver_abc123' });

    const bodies = postedBodies();
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.versionRef).toBe('ver_abc123');
    }
  });

  test('forwards the latest and draft sentinels unchanged', async () => {
    for (const ref of ['latest', 'draft']) {
      jest.clearAllMocks();
      await voiceAgent.start({ agentId: 'test-agent', versionRef: ref });

      for (const body of postedBodies()) {
        expect(body.versionRef).toBe(ref);
      }
    }
  });

  test('leaves the rest of the body alone', async () => {
    await voiceAgent.start({
      agentId: 'test-agent',
      versionRef: 'latest',
      params: { userName: 'Sara' },
    });

    const [tokenBody] = postedBodies();
    expect(tokenBody.voiceAgentId).toBe('test-agent');
    expect(tokenBody.params).toEqual({ userName: 'Sara' });
  });
});

describe('environmentId Parameter', () => {
  let voiceAgent: HamsaVoiceAgent;

  const postedBodies = () =>
    (global.fetch as any).mock.calls.map(([, init]: [string, RequestInit]) =>
      JSON.parse(String(init.body))
    );

  beforeEach(() => {
    jest.clearAllMocks();
    voiceAgent = new HamsaVoiceAgent('test-api-key');

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { liveKitAccessToken: 'mock-token', jobId: 'job-123' },
        }),
    });
  });

  test('sends nothing on the wire when it is not given', async () => {
    // The normal case by a wide margin: values follow the version, so a caller
    // naming `prod` already implies prod's values and has nothing to override.
    await voiceAgent.start({ agentId: 'test-agent', versionRef: 'prod' });

    for (const body of postedBodies()) {
      expect(body).not.toHaveProperty('environmentId');
    }
  });

  test('forwards the override to both endpoints', async () => {
    await voiceAgent.start({
      agentId: 'test-agent',
      environmentId: 'env_staging',
    });

    const bodies = postedBodies();
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.environmentId).toBe('env_staging');
    }
  });

  test('carries both axes at once, which is the whole point', async () => {
    // Run that exact version, but resolve its values somewhere else. An
    // operator reading an old version against staging values is the one
    // workflow this field exists for.
    await voiceAgent.start({
      agentId: 'test-agent',
      versionRef: 'ver_abc123',
      environmentId: 'env_staging',
    });

    for (const body of postedBodies()) {
      expect(body.versionRef).toBe('ver_abc123');
      expect(body.environmentId).toBe('env_staging');
    }
  });

  test('leaves the rest of the body alone', async () => {
    await voiceAgent.start({
      agentId: 'test-agent',
      environmentId: 'env_staging',
      params: { userName: 'Sara' },
    });

    const [tokenBody] = postedBodies();
    expect(tokenBody.voiceAgentId).toBe('test-agent');
    expect(tokenBody.params).toEqual({ userName: 'Sara' });
  });
});
