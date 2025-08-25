/**
 * Fetch Mock Utilities
 *
 * Provides reusable mock utilities for testing fetch-related functionality
 * to eliminate repetitive fetch mock setup and response creation.
 */

/**
 * Creates a successful API response mock with LiveKit token data
 * @param liveKitAccessToken - The mock LiveKit access token
 * @param jobId - The mock job ID
 * @returns Mock Response object
 */
export function createSuccessfulTokenResponse(
  liveKitAccessToken = 'mock-livekit-token',
  jobId = 'mock-job-id'
): unknown {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      success: true,
      data: {
        liveKitAccessToken,
        jobId,
      },
    }),
  } as unknown as Response;
}

/**
 * Creates a failed API response mock
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param errorMessage - Error message to return
 * @returns Mock Response object
 */
export function createFailedResponse(
  status = 401,
  statusText = 'Unauthorized',
  errorMessage = 'Invalid API key'
): unknown {
  return {
    ok: false,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(errorMessage),
  } as unknown as Response;
}

/**
 * Creates a successful API response for job details
 * @param jobDetails - The job details object
 * @returns Mock Response object
 */
export function createJobDetailsResponse(jobDetails: any): unknown {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      data: jobDetails,
    }),
  } as unknown as Response;
}

/**
 * Creates an API error response with structured error data
 * @param error - Error message
 * @returns Mock Response object
 */
export function createErrorResponse(error = 'Invalid agent ID'): unknown {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      success: false,
      error,
    }),
  } as unknown as Response;
}

/**
 * Sets up fetch mock for a successful conversation initialization
 * @param liveKitAccessToken - Mock token
 * @param jobId - Mock job ID
 */
export function mockSuccessfulConversationInit(
  liveKitAccessToken = 'mock-livekit-token',
  jobId = 'mock-job-id'
): void {
  fetch.mockResolvedValue(
    createSuccessfulTokenResponse(liveKitAccessToken, jobId)
  );
}

/**
 * Sets up fetch mock for a failed conversation initialization
 * @param status - HTTP status code
 * @param errorMessage - Error message
 */
export function mockFailedConversationInit(
  status = 401,
  errorMessage = 'Invalid API key'
): void {
  fetch.mockResolvedValue(
    createFailedResponse(status, 'Unauthorized', errorMessage)
  );
}

/**
 * Sets up fetch mock to reject with a network error
 * @param errorMessage - The error message
 */
export function mockNetworkError(errorMessage = 'Network error'): void {
  fetch.mockRejectedValue(new Error(errorMessage));
}

/**
 * Sets up fetch mock for successful job details retrieval followed by job details
 * @param tokenResponse - Initial token response data
 * @param jobDetails - Job details to return
 */
export function mockJobDetailsFlow(
  tokenResponse = { liveKitAccessToken: 'token', jobId: 'job-123' },
  jobDetails = { status: 'COMPLETED', duration: 120, transcript: 'Hello world' }
): void {
  fetch
    .mockResolvedValueOnce(
      createSuccessfulTokenResponse(
        tokenResponse.liveKitAccessToken,
        tokenResponse.jobId
      )
    )
    .mockResolvedValueOnce(createJobDetailsResponse(jobDetails));
}

/**
 * Extracts the request body from fetch mock calls
 * @param callIndex - Which fetch call to examine (default: 0)
 * @returns Parsed request body object
 */
export function extractFetchRequestBody(callIndex = 0): any {
  const call = fetch.mock.calls[callIndex];
  if (!call?.[1]) {
    throw new Error(`No fetch call found at index ${callIndex}`);
  }

  const body = (call[1] as any).body;
  if (!body) {
    throw new Error('No request body found in fetch call');
  }

  return JSON.parse(body);
}

/**
 * Gets headers from a fetch call for verification
 * @param expectedHeaders - Headers that should be present
 * @param callIndex - Which fetch call to examine (default: 0)
 * @returns The headers object from the fetch call
 */
export function getFetchHeaders(callIndex = 0): Record<string, string> | null {
  const call = (fetch as any).mock.calls[callIndex];
  if (!call?.[1]) {
    return null;
  }

  return (call[1] as any).headers || null;
}
