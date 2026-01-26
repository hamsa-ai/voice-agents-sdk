/**
 * LiveKit Manager - Tool Registry Events Tests
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { RpcError } from 'livekit-client';
import { setupTest, type TestContext } from './shared-setup';

describe('LiveKitManager - Tool Registry Events', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  test('should emit toolsRegistered event with tools list', () => {
    const { liveKitManager } = context;
    const tools = [
      {
        function_name: 'testTool1',
        fn: jest.fn().mockResolvedValue('result1'),
      },
    ];

    const toolsRegisteredSpy = jest.fn();
    liveKitManager.on('toolsRegistered', toolsRegisteredSpy);

    liveKitManager.registerTools(tools);

    expect(toolsRegisteredSpy).toHaveBeenCalledWith(tools);
  });

  test('should emit rpcError event when tool execution fails', async () => {
    const { liveKitManager, mockRoom } = context;
    const mockError = new Error('Tool execution failed');
    const mockTool = {
      function_name: 'errorTool',
      fn: jest.fn().mockRejectedValue(mockError),
    };

    const rpcErrorSpy = jest.fn();
    liveKitManager.on('rpcError', rpcErrorSpy);

    liveKitManager.registerTools([mockTool]);

    // Get the RPC handler function
    const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

    // Mock RPC data
    const rpcData = {
      payload: JSON.stringify({ param1: 'value1' }),
    };

    await rpcHandler(rpcData);

    expect(rpcErrorSpy).toHaveBeenCalledWith('errorTool', mockError);
  });

  test('should emit rpcError event when tool execution fails with RpcError', async () => {
    const { liveKitManager, mockRoom } = context;
    const ERROR_CODE = 1500;
    const mockRpcError = new RpcError(
      ERROR_CODE,
      'Custom RPC Error',
      'Some data'
    );
    const mockTool = {
      function_name: 'rpcErrorTool',
      fn: jest.fn().mockRejectedValue(mockRpcError),
    };

    const rpcErrorSpy = jest.fn();
    liveKitManager.on('rpcError', rpcErrorSpy);

    liveKitManager.registerTools([mockTool]);

    // Get the RPC handler function
    const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

    // Mock RPC data
    const rpcData = {
      payload: JSON.stringify({}),
    };

    await rpcHandler(rpcData);

    expect(rpcErrorSpy).toHaveBeenCalledWith('rpcErrorTool', mockRpcError);
  });

  test('should pass RpcInvocationData to tool function', async () => {
    const { liveKitManager, mockRoom } = context;
    const mockTool = {
      function_name: 'dataTool',
      fn: jest.fn().mockResolvedValue('success'),
    };

    liveKitManager.registerTools([mockTool]);

    // Get the RPC handler function
    const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

    // Mock RPC data including invocation metadata
    const rpcData = {
      payload: JSON.stringify({ arg1: 'val1' }),
      callerIdentity: 'agent-123',
      requestId: 'req-456',
      responseTimeout: 10_000,
    };

    await rpcHandler(rpcData);

    // Should be called with argument AND the raw data object
    expect(mockTool.fn).toHaveBeenCalledWith('val1', rpcData);
  });
});
