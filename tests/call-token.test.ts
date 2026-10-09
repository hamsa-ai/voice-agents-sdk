import HamsaVoiceAgent from '../src/main';

global.fetch = jest.fn();

const MENTIONS_CALL_TOKEN = /callToken/;
const MENTIONS_API_KEY = /API key/;

/** Every request the SDK made, as [url, init]. */
const requests = () =>
  (global.fetch as any).mock.calls as [string, RequestInit][];

const authHeaders = () =>
  requests().map(
    ([, init]) => (init.headers as Record<string, string>).Authorization
  );

const postedBodies = () =>
  requests().map(([, init]) => JSON.parse(String(init.body)));

describe('callToken', () => {
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

  test('starts a call with no API key at all', async () => {
    // The point of the token: a page that starts calls this way never holds a
    // key, so there is nothing in it worth copying.
    const agent = new HamsaVoiceAgent({ region: 'eu' });
    expect(agent.apiKey).toBeNull();

    await agent.start({ agentId: 'test-agent', callToken: 'ct_abc' });

    expect(requests().length).toBeGreaterThan(0);
    for (const header of authHeaders()) {
      expect(header).toBe('CallToken ct_abc');
    }
  });

  test('sends the token on both call-start requests', async () => {
    const agent = new HamsaVoiceAgent({});
    await agent.start({ agentId: 'test-agent', callToken: 'ct_abc' });

    const urls = requests().map(([url]) => url);
    expect(urls.some((u) => u.endsWith('/room/participant-token'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/room/conversation-init'))).toBe(true);
    expect(new Set(authHeaders())).toEqual(new Set(['CallToken ct_abc']));
  });

  test('prefers the token over a key when given both', async () => {
    const agent = new HamsaVoiceAgent('test-api-key');
    await agent.start({ agentId: 'test-agent', callToken: 'ct_abc' });

    for (const header of authHeaders()) {
      expect(header).toBe('CallToken ct_abc');
    }
  });

  test('does not send versionRef or environmentId next to a token', async () => {
    // The token already decided them at mint time. Sending them would suggest
    // the browser has a say, which is exactly what the token takes away.
    const agent = new HamsaVoiceAgent({});
    await agent.start({
      agentId: 'test-agent',
      callToken: 'ct_abc',
      versionRef: 'draft',
      environmentId: 'env_staging',
    });

    for (const body of postedBodies()) {
      expect(body).not.toHaveProperty('versionRef');
      expect(body).not.toHaveProperty('environmentId');
    }
  });

  test('leaves the rest of the body alone', async () => {
    const agent = new HamsaVoiceAgent({});
    await agent.start({
      agentId: 'test-agent',
      callToken: 'ct_abc',
      isChatOnly: true,
      params: { userName: 'Sara' },
    });

    const [tokenBody] = postedBodies();
    expect(tokenBody.voiceAgentId).toBe('test-agent');
    expect(tokenBody.isChatOnly).toBe(true);
    expect(tokenBody.params).toEqual({ userName: 'Sara' });
  });

  test('keeps the key path byte-identical without a token', async () => {
    const agent = new HamsaVoiceAgent('test-api-key');
    await agent.start({ agentId: 'test-agent', versionRef: 'ver_1' });

    for (const header of authHeaders()) {
      expect(header).toBe('Token test-api-key');
    }
    for (const body of postedBodies()) {
      expect(body.versionRef).toBe('ver_1');
    }
  });

  test('refuses to start with neither a key nor a token, before any request', async () => {
    const agent = new HamsaVoiceAgent({});
    const onError = jest.fn();
    agent.on('error', onError);

    await agent.start({ agentId: 'test-agent' });

    expect(requests()).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0].message)).toMatch(
      MENTIONS_CALL_TOKEN
    );
  });

  test('keeps the config when it is passed first', () => {
    const agent = new HamsaVoiceAgent({
      API_URL: 'https://api.example.com',
      LIVEKIT_URL: 'wss://rtc.example.com',
    });
    expect(agent.API_URL).toBe('https://api.example.com');
    expect(agent.LIVEKIT_URL).toBe('wss://rtc.example.com');
  });

  test('treats an empty key as no key', () => {
    const agent = new HamsaVoiceAgent('');
    expect(agent.apiKey).toBeNull();
  });

  test('getJobDetails needs a real key, not a spent token', async () => {
    const agent = new HamsaVoiceAgent({});
    await agent.start({ agentId: 'test-agent', callToken: 'ct_abc' });

    await expect(agent.getJobDetails()).rejects.toThrow(MENTIONS_API_KEY);
  });
});
