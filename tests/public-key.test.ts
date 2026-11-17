import HamsaVoiceAgent, { HamsaApiError } from '../src/main';

global.fetch = jest.fn();

const MINT = '/v1/voice-agents/call-token';

const HTTP = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  tooMany: 429,
};
const RETRY_AFTER_SECONDS = 12;

const STAGING_RUNS_NOTHING = /staging runs nothing/;
const WAIT_TWELVE_SECONDS = /12 seconds/;
const TRY_AGAIN_SHORTLY = /Try again shortly/;
const OTHER_AGENTS = /limited to other agents/;
const REPLACED = /replaced by a newer one/;
const FUNCTION_FAILED = /callToken function failed: server down/;
const NO_TOKEN = /returned no token/;
const STAYS_ON_SERVER = /must stay on your server/;
const STARTS_WITH_PK = /starting with pk_/;
const PASS_AS_PUBLIC_KEY = /pass it as publicKey/;
const USED_OR_EXPIRED = /already used, or has expired/;

/** Every request the SDK made, as [url, init]. */
const requests = () =>
  (global.fetch as any).mock.calls as [string, RequestInit][];
const urls = () => requests().map(([url]) => url);
const authOf = (init: RequestInit) =>
  (init.headers as Record<string, string>).Authorization;
const bodyOf = (init: RequestInit) => JSON.parse(String(init.body));

const ok = (data: unknown) => ({
  ok: true,
  status: 201,
  headers: { get: () => null },
  json: () => Promise.resolve({ success: true, data }),
  text: () => Promise.resolve(JSON.stringify({ success: true, data })),
});

const refused = (
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) => ({
  ok: false,
  status,
  statusText: 'Refused',
  headers: { get: (name: string) => headers[name] ?? null },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

/** Answer the mint with `mint`, and every call-start request with a room. */
function serve(mint: unknown = ok({ callToken: 'ct_minted' })) {
  (global.fetch as any).mockImplementation((url: string) =>
    Promise.resolve(
      url.endsWith(MINT)
        ? mint
        : ok({ liveKitAccessToken: 'mock-token', jobId: 'job-123' })
    )
  );
}

/** Start, and return the error the agent emitted, if any. */
async function startCatching(
  agent: HamsaVoiceAgent,
  options: Parameters<HamsaVoiceAgent['start']>[0]
) {
  const onError = jest.fn();
  agent.on('error', onError);
  await agent.start(options);
  return onError.mock.calls[0]?.[0] as Error | undefined;
}

describe('publicKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serve();
  });

  test('mints a call token with the key, then starts the call with it', async () => {
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    expect(agent.publicKey).toBe('pk_test');
    expect(agent.apiKey).toBeNull();

    await agent.start({ agentId: 'agent-1', isChatOnly: true });

    const [[mintUrl, mintInit], ...rest] = requests();
    expect(mintUrl.endsWith(MINT)).toBe(true);
    expect(mintInit.method).toBe('POST');
    expect(authOf(mintInit)).toBe('Token pk_test');
    // Only what a public key may ask for: the key is the environment.
    expect(bodyOf(mintInit)).toEqual({
      voiceAgentId: 'agent-1',
      isChatOnly: true,
    });

    expect(rest.length).toBeGreaterThan(0);
    for (const [, init] of rest) {
      expect(authOf(init)).toBe('CallToken ct_minted');
    }
    expect(urls().some((u) => u.endsWith('/room/participant-token'))).toBe(
      true
    );
  });

  test('sends callerKey with the mint, so an A/B test keeps the person on one side', async () => {
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    await agent.start({ agentId: 'agent-1', callerKey: 'user-42' });

    const [[, mintInit]] = requests();
    expect(bodyOf(mintInit)).toEqual({
      voiceAgentId: 'agent-1',
      isChatOnly: false,
      callerKey: 'user-42',
    });
  });

  test('works with the key in the second argument too', async () => {
    const agent = new HamsaVoiceAgent(undefined, {
      region: 'uae',
      publicKey: 'pk_test',
    });
    await agent.start({ agentId: 'agent-1' });
    expect(authOf(requests()[0][1])).toBe('Token pk_test');
  });

  test('refuses versionRef or environmentId before any request', async () => {
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = await startCatching(agent, {
      agentId: 'agent-1',
      versionRef: 'draft',
    });

    expect(requests()).toHaveLength(0);
    expect(error).toBeInstanceOf(HamsaApiError);
    expect((error as HamsaApiError).messageKey).toBe(
      'PublicKeyFixedEnvironment'
    );
  });

  test('says what to do when the environment runs nothing', async () => {
    serve(
      refused(HTTP.conflict, {
        message: 'Environment not deployed',
        messageKey: 'EnvironmentNotDeployed',
        params: { environment: 'staging', voiceAgentId: 'agent-1' },
      })
    );
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
    })) as HamsaApiError;

    // Refused at the mint: no call is started.
    expect(urls()).toHaveLength(1);
    expect(error).toBeInstanceOf(HamsaApiError);
    expect(error.messageKey).toBe('EnvironmentNotDeployed');
    expect(error.status).toBe(HTTP.conflict);
    expect(error.params).toEqual({
      environment: 'staging',
      voiceAgentId: 'agent-1',
    });
    expect(error.message).toMatch(STAGING_RUNS_NOTHING);
  });

  test('passes on how long to wait when rate limited', async () => {
    serve(
      refused(
        HTTP.tooMany,
        { message: 'Too many requests', messageKey: 'ApiKeyRateLimited' },
        { 'Retry-After': String(RETRY_AFTER_SECONDS) }
      )
    );
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
    })) as HamsaApiError;

    expect(error.messageKey).toBe('ApiKeyRateLimited');
    expect(error.retryAfter).toBe(RETRY_AFTER_SECONDS);
    expect(error.message).toMatch(WAIT_TWELVE_SECONDS);
  });

  test('a rate limit whose Retry-After the page cannot read says "shortly", not 0 seconds', async () => {
    serve(
      refused(HTTP.tooMany, {
        message: 'Too many requests',
        messageKey: 'ApiKeyRateLimited',
      })
    );
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
    })) as HamsaApiError;

    expect(error.messageKey).toBe('ApiKeyRateLimited');
    expect(error.retryAfter).toBeUndefined();
    expect(error.message).toMatch(TRY_AGAIN_SHORTLY);
  });

  test.each([
    ['KeyNotForAgent', HTTP.forbidden, OTHER_AGENTS],
    ['KeyRotated', HTTP.unauthorized, REPLACED],
  ])('explains %s', async (messageKey, status, sentence) => {
    serve(refused(status, { message: 'refused', messageKey }));
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
    })) as HamsaApiError;

    expect(error.messageKey).toBe(messageKey);
    expect(error.status).toBe(status);
    expect(error.message).toMatch(sentence);
  });

  test('rejects start() with the refusal when the page has no error listener', async () => {
    serve(
      refused(HTTP.conflict, {
        message: 'Environment not deployed',
        messageKey: 'EnvironmentNotDeployed',
        params: { environment: 'staging' },
      })
    );
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });

    await expect(agent.start({ agentId: 'agent-1' })).rejects.toMatchObject({
      name: 'HamsaApiError',
      messageKey: 'EnvironmentNotDeployed',
      status: HTTP.conflict,
    });
  });

  test("keeps the API's own message for a refusal it does not know", async () => {
    serve(
      refused(HTTP.badRequest, {
        message: 'Something specific',
        messageKey: 'NewThing',
      })
    );
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
    })) as HamsaApiError;
    expect(error.message).toBe('Something specific');
    expect(error.messageKey).toBe('NewThing');
  });
});

describe('callToken as a function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serve();
  });

  test('is called once, as the call starts, and its token is used', async () => {
    const getToken = jest.fn(() => Promise.resolve('ct_from_server'));
    const agent = new HamsaVoiceAgent({});
    await agent.start({ agentId: 'agent-1', callToken: getToken });

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(urls().some((u) => u.endsWith(MINT))).toBe(false);
    for (const [, init] of requests()) {
      expect(authOf(init)).toBe('CallToken ct_from_server');
    }
  });

  test('may return the token directly', async () => {
    const agent = new HamsaVoiceAgent({});
    await agent.start({ agentId: 'agent-1', callToken: () => 'ct_sync' });
    expect(authOf(requests()[0][1])).toBe('CallToken ct_sync');
  });

  test('wins over a public key: the server chose the version', async () => {
    const agent = new HamsaVoiceAgent({ publicKey: 'pk_test' });
    await agent.start({
      agentId: 'agent-1',
      callToken: async () => 'ct_from_server',
      versionRef: 'draft',
    });

    expect(urls().some((u) => u.endsWith(MINT))).toBe(false);
    for (const [, init] of requests()) {
      expect(authOf(init)).toBe('CallToken ct_from_server');
      expect(bodyOf(init)).not.toHaveProperty('versionRef');
    }
  });

  test('a failing function stops the start, saying why', async () => {
    const agent = new HamsaVoiceAgent({});
    const error = await startCatching(agent, {
      agentId: 'agent-1',
      callToken: () => Promise.reject(new Error('server down')),
    });

    expect(requests()).toHaveLength(0);
    expect(error?.message).toMatch(FUNCTION_FAILED);
  });

  test('a spent token refused at the call start keeps its status, in words', async () => {
    (global.fetch as any).mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/room/participant-token')
          ? refused(HTTP.unauthorized, {
              message: 'Invalid call token',
              messageKey: 'CallTokenInvalid',
            })
          : ok({ liveKitAccessToken: 'mock-token', jobId: 'job-123' })
      )
    );
    const agent = new HamsaVoiceAgent({});
    const error = (await startCatching(agent, {
      agentId: 'agent-1',
      callToken: 'ct_spent',
    })) as HamsaApiError;

    expect(error).toBeInstanceOf(HamsaApiError);
    expect(error.messageKey).toBe('CallTokenInvalid');
    expect(error.status).toBe(HTTP.unauthorized);
    expect(error.message).toMatch(USED_OR_EXPIRED);
  });

  test('without an error listener, a failing function rejects start()', async () => {
    const agent = new HamsaVoiceAgent({});
    await expect(
      agent.start({
        agentId: 'agent-1',
        callToken: () => Promise.reject(new Error('server down')),
      })
    ).rejects.toThrow(FUNCTION_FAILED);
    expect(requests()).toHaveLength(0);
  });

  test('a function that returns nothing stops the start', async () => {
    const agent = new HamsaVoiceAgent({});
    const error = await startCatching(agent, {
      agentId: 'agent-1',
      callToken: () => '',
    });

    expect(requests()).toHaveLength(0);
    expect(error?.message).toMatch(NO_TOKEN);
  });
});

describe('keys in the wrong place', () => {
  test('refuses a secret key in a page, as the API key', () => {
    expect(() => new HamsaVoiceAgent('sk_secret')).toThrow(STAYS_ON_SERVER);
  });

  test('refuses a secret key in a page, as the public key', () => {
    expect(() => new HamsaVoiceAgent({ publicKey: 'sk_secret' })).toThrow(
      STAYS_ON_SERVER
    );
  });

  test('refuses a publicKey that is not one', () => {
    expect(() => new HamsaVoiceAgent({ publicKey: 'hamsa_old_key' })).toThrow(
      STARTS_WITH_PK
    );
  });

  test('points a public key passed as the API key to publicKey', () => {
    expect(() => new HamsaVoiceAgent('pk_test')).toThrow(PASS_AS_PUBLIC_KEY);
  });

  test('leaves an existing API key working as before', () => {
    const agent = new HamsaVoiceAgent('legacy-api-key');
    expect(agent.apiKey).toBe('legacy-api-key');
    expect(agent.publicKey).toBeNull();
  });
});
