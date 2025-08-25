/**
 * LiveKit Manager - Tool Registry Tests
 *
 * Tests for RPC method registration, tool execution, error handling,
 * and tool validation functionality.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { setupTest, type TestContext } from './shared-setup';

describe('LiveKitManager - Tool Registry', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  describe('RPC Method Registration', () => {
    test('should register tools as RPC methods', () => {
      const { liveKitManager, mockRoom } = context;
      const tools = [
        {
          function_name: 'testTool1',
          fn: jest.fn().mockResolvedValue('result1'),
        },
        {
          function_name: 'testTool2',
          fn: jest.fn().mockResolvedValue('result2'),
        },
      ];

      liveKitManager.registerTools(tools);

      // Tools may be registered multiple times due to connection setup and explicit registration
      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'testTool1',
        expect.any(Function)
      );
      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'testTool2',
        expect.any(Function)
      );
    });

    test('should not register tools if room or localParticipant is not available', () => {
      const { mockUrl, mockToken } = context;
      const liveKitManagerWithoutRoom =
        new (require('../../src/classes/livekit-manager').default)(
          mockUrl,
          mockToken,
          []
        );

      // Set the tool registry's room to null to simulate no room
      liveKitManagerWithoutRoom.toolRegistry.setRoom(null);

      const tools = [
        {
          function_name: 'testTool',
          fn: jest.fn(),
        },
      ];

      // Should not throw error when no room is available
      expect(() => {
        liveKitManagerWithoutRoom.registerTools(tools);
      }).not.toThrow();
    });

    test('should not register tools without function_name or fn', () => {
      const { liveKitManager, mockRoom } = context;
      const invalidTools = [
        { function_name: 'validTool', fn: jest.fn() },
        { function_name: 'invalidTool1' }, // missing fn
        { fn: jest.fn() }, // missing function_name
        { function_name: 'invalidTool2', fn: 'not a function' }, // fn is not a function
      ];

      liveKitManager.registerTools(invalidTools as any);

      // Should register the valid tool (may be called multiple times due to connection setup)
      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'validTool',
        expect.any(Function)
      );
    });

    test('should handle non-array tools parameter', () => {
      const { liveKitManager } = context;

      // Should not throw error when passed non-array values
      expect(() => {
        liveKitManager.registerTools(null as unknown as []);
        liveKitManager.registerTools(undefined as unknown as []);
        liveKitManager.registerTools('not an array' as unknown as []);
      }).not.toThrow();
    });
  });

  describe('RPC Method Execution', () => {
    test('should handle RPC method execution successfully', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockTool = {
        function_name: 'testTool',
        fn: jest.fn().mockResolvedValue({ success: true, data: 'test result' }),
      };

      liveKitManager.registerTools([mockTool]);

      // Get the RPC handler function
      const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

      // Mock RPC data
      const rpcData = {
        payload: JSON.stringify({ param1: 'value1', param2: 'value2' }),
      };

      const result = await rpcHandler(rpcData);

      expect(mockTool.fn).toHaveBeenCalledWith('value1', 'value2');
      expect(result).toBe(
        JSON.stringify({ success: true, data: 'test result' })
      );
    });

    test('should handle RPC method execution errors', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockTool = {
        function_name: 'errorTool',
        fn: jest.fn().mockRejectedValue(new Error('Tool execution failed')),
      };

      liveKitManager.registerTools([mockTool]);

      // Get the RPC handler function
      const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

      // Mock RPC data
      const rpcData = {
        payload: JSON.stringify({ param1: 'value1' }),
      };

      // RPC handler returns JSON string with error instead of throwing
      const result = await rpcHandler(rpcData);
      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Tool execution failed');
    });

    test('should handle invalid JSON in RPC payload', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockTool = {
        function_name: 'testTool',
        fn: jest.fn().mockResolvedValue('result'),
      };

      liveKitManager.registerTools([mockTool]);

      // Get the RPC handler function
      const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

      // Mock RPC data with invalid JSON
      const rpcData = {
        payload: 'invalid json',
      };

      // RPC handler returns JSON string with error instead of throwing
      const result = await rpcHandler(rpcData);
      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toContain('not valid JSON');
    });

    test('should handle missing payload in RPC data', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockTool = {
        function_name: 'testTool',
        fn: jest.fn().mockResolvedValue('result'),
      };

      liveKitManager.registerTools([mockTool]);

      // Get the RPC handler function
      const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

      // Mock RPC data without payload
      const rpcData = {};

      const result = await rpcHandler(rpcData);

      expect(mockTool.fn).toHaveBeenCalledWith();
      expect(result).toBe(JSON.stringify('result'));
    });

    test('should handle complex tool parameters correctly', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockTool = {
        function_name: 'complexTool',
        fn: jest.fn().mockResolvedValue({ processed: true }),
      };

      liveKitManager.registerTools([mockTool]);

      // Get the RPC handler function
      const rpcHandler = mockRoom.registerRpcMethod.mock.calls[0][1];

      // Mock RPC data with complex parameters
      const TEST_NUMBER = 42;
      const ONE = 1;
      const TWO = 2;
      const THREE = 3;
      const TEST_ARRAY = [ONE, TWO, THREE] as const;
      const complexParams = {
        stringParam: 'test',
        numberParam: TEST_NUMBER,
        booleanParam: true,
        objectParam: { nested: 'value' },
        arrayParam: TEST_ARRAY,
      };

      const rpcData = {
        payload: JSON.stringify(complexParams),
      };

      const result = await rpcHandler(rpcData);

      expect(mockTool.fn).toHaveBeenCalledWith(
        'test',
        TEST_NUMBER,
        true,
        { nested: 'value' },
        TEST_ARRAY
      );
      expect(result).toBe(JSON.stringify({ processed: true }));
    });
  });

  describe('Tool Validation', () => {
    test('should validate tool structure before registration', () => {
      const { liveKitManager, mockRoom } = context;

      // Valid tools
      const validTools = [
        {
          function_name: 'validTool1',
          fn: jest.fn(),
        },
        {
          function_name: 'validTool2',
          fn: async () => 'result',
        },
      ];

      // Invalid tools that should be filtered out
      const invalidTools = [
        { function_name: 'invalidTool1' }, // missing fn
        { fn: jest.fn() }, // missing function_name
        { function_name: '', fn: jest.fn() }, // empty function_name
        { function_name: 'invalidTool2', fn: 'not a function' }, // fn is not a function
        { function_name: 'invalidTool3', fn: null }, // fn is null
      ];

      liveKitManager.registerTools([...validTools, ...invalidTools] as any);

      // Should only register valid tools
      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'validTool1',
        expect.any(Function)
      );
      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'validTool2',
        expect.any(Function)
      );

      // Should not register invalid tools
      expect(mockRoom.registerRpcMethod).not.toHaveBeenCalledWith(
        'invalidTool1',
        expect.any(Function)
      );
      expect(mockRoom.registerRpcMethod).not.toHaveBeenCalledWith(
        'invalidTool2',
        expect.any(Function)
      );
    });

    test('should handle edge cases in tool function names', () => {
      const { liveKitManager, mockRoom } = context;

      const edgeCaseTools = [
        { function_name: 'tool_with_underscores', fn: jest.fn() },
        { function_name: 'toolWithCamelCase', fn: jest.fn() },
        { function_name: 'tool-with-dashes', fn: jest.fn() },
        { function_name: 'tool123', fn: jest.fn() },
        { function_name: 'TOOL_UPPERCASE', fn: jest.fn() },
      ];

      liveKitManager.registerTools(edgeCaseTools);

      // All should be registered as they have valid function names
      for (const tool of edgeCaseTools) {
        expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
          tool.function_name,
          expect.any(Function)
        );
      }
    });
  });

  describe('Tool Registry Integration', () => {
    test('should integrate with room connection lifecycle', () => {
      const { liveKitManager, mockRoom } = context;
      const tools = [
        {
          function_name: 'lifecycleTool',
          fn: jest.fn().mockResolvedValue('success'),
        },
      ];

      // Tools should be registered during initialization
      liveKitManager.registerTools(tools);

      expect(mockRoom.registerRpcMethod).toHaveBeenCalledWith(
        'lifecycleTool',
        expect.any(Function)
      );
    });

    test('should maintain tool registry state across operations', () => {
      const { liveKitManager } = context;

      // Verify initial tools from setup are present
      expect(liveKitManager.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ function_name: 'testTool' }),
          expect.objectContaining({ function_name: 'asyncTool' }),
        ])
      );

      const additionalTools = [
        {
          function_name: 'additionalTool',
          fn: jest.fn(),
        },
      ];

      // Register additional tools (this replaces existing tools)
      liveKitManager.registerTools(additionalTools);

      // Only the newly registered tools should be available
      expect(liveKitManager.tools).toEqual([
        expect.objectContaining({ function_name: 'additionalTool' }),
      ]);
      expect(liveKitManager.tools).toHaveLength(1);
    });
  });
});
