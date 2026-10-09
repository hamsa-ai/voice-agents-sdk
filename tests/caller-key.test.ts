import HamsaVoiceAgent from '../src/main';

global.fetch = jest.fn();

const MAX_CALLER_KEY_LENGTH = 200;
const TOO_LONG = 'x'.repeat(MAX_CALLER_KEY_LENGTH + 1);
const MENTIONS_CALLER_KEY = /callerKey/;

/** Every request the SDK made, as [url, body]. */
const posted = () =>
  ((global.fetch as any).mock.calls as [string, RequestInit][]).map(
    ([url, init]) => [url, JSON.parse(String(init.body))] as const
  );

describe('callerKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { liveKitAccessToken: 'mock-token', jobId: 'job-123' },
        }),
    });
  });

  test('sends it on participant-token only', async () => {
    // conversation-init reuses the version participant-token chose.
    const agent = new HamsaVoiceAgent({});
    await agent.start({
      agentId: 'test-agent',
      callToken: 'ct_abc',
      callerKey: 'user-42',
    });

    const byPath = new Map(
      posted().map(([url, body]) => [url.split('/').pop(), body])
    );
    expect(byPath.get('participant-token')?.callerKey).toBe('user-42');
    expect(byPath.get('conversation-init')).not.toHaveProperty('callerKey');
  });

  test('sends nothing without it', async () => {
    const agent = new HamsaVoiceAgent('test-api-key');
    await agent.start({ agentId: 'test-agent' });

    for (const [, body] of posted()) {
      expect(body).not.toHaveProperty('callerKey');
    }
  });

  test('refuses one longer than 200 characters, before any request', async () => {
    const agent = new HamsaVoiceAgent('test-api-key');
    const onError = jest.fn();
    agent.on('error', onError);

    await agent.start({ agentId: 'test-agent', callerKey: TOO_LONG });

    expect(posted()).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0].message)).toMatch(
      MENTIONS_CALLER_KEY
    );
  });
});
