/**
 * LiveKit Manager - Tool Registry Events Tests
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { RpcError } from 'livekit-client';
import { LiveKitToolRegistry } from '../../src/classes/livekit-tool-registry';
import { createMockRoom } from '../utils/livekit-mocks';
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

  describe('messageReceived event', () => {
    test('should emit a structured agent message with id and isFinal', () => {
      const { liveKitManager } = context;
      const messageSpy = jest.fn();
      liveKitManager.on('messageReceived', messageSpy);

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-1', text: 'Hello there', final: true }],
        'agent-123'
      );

      expect(messageSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'seg-1',
          role: 'agent',
          text: 'Hello there',
          isFinal: true,
        })
      );
      expect(messageSpy.mock.calls[0][0].timestamp).toEqual(expect.any(Number));
    });

    test('should mark user transcriptions with role "user"', () => {
      const { liveKitManager } = context;
      const messageSpy = jest.fn();
      liveKitManager.on('messageReceived', messageSpy);

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-2', text: 'My order number', final: false }],
        'user-789'
      );

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'seg-2',
          role: 'user',
          isFinal: false,
        })
      );
    });

    test('should keep a stable id across streaming partials of one message', () => {
      const { liveKitManager } = context;
      const ids: string[] = [];
      liveKitManager.on('messageReceived', (m) => ids.push(m.id));

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-3', text: 'Hel', final: false }],
        'agent-1'
      );
      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-3', text: 'Hello', final: true }],
        'agent-1'
      );

      expect(ids).toEqual(['seg-3', 'seg-3']);
    });

    test('should synthesize an id when the segment has none', () => {
      const { liveKitManager } = context;
      const messageSpy = jest.fn();
      liveKitManager.on('messageReceived', messageSpy);

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ text: 'No id here', final: true }],
        'agent-1'
      );

      const message = messageSpy.mock.calls[0][0];
      expect(typeof message.id).toBe('string');
      expect(message.id.length).toBeGreaterThan(0);
    });

    test('should still emit the legacy answerReceived event', () => {
      const { liveKitManager } = context;
      const answerSpy = jest.fn();
      liveKitManager.on('answerReceived', answerSpy);

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-4', text: 'Backward compatible', final: true }],
        'agent-1'
      );

      expect(answerSpy).toHaveBeenCalledWith('Backward compatible');
    });
  });

  describe('inbound chat text stream (lk.chat)', () => {
    // Sync generator under asyncIterator is fine: `for await` awaits each
    // yielded value. Avoids an async fn with no await (biome useAwait).
    const makeTextReader = (chunks: string[], id: string) => ({
      info: { id },
      *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    test('registers a text-stream handler on lk.chat when the room is set', () => {
      const { mockRoom } = context;
      expect(mockRoom.registerTextStreamHandler).toHaveBeenCalledWith(
        'lk.chat',
        expect.any(Function)
      );
    });

    test('emits streaming partials then a final agent message', async () => {
      const { liveKitManager, mockRoom } = context;
      const handler = mockRoom.registerTextStreamHandler.mock.calls[0][1];
      const received: Record<string, unknown>[] = [];
      liveKitManager.on('messageReceived', (m) => received.push(m));

      await handler(makeTextReader(['Hel', 'lo'], 'stream-1'), {
        identity: 'agent-1',
      });

      expect(
        received.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          isFinal: m.isFinal,
        }))
      ).toEqual([
        { id: 'stream-1', role: 'agent', text: 'Hel', isFinal: false },
        { id: 'stream-1', role: 'agent', text: 'Hello', isFinal: false },
        { id: 'stream-1', role: 'agent', text: 'Hello', isFinal: true },
      ]);
    });

    test('labels a stream from the local participant as the user role', async () => {
      const { liveKitManager, mockRoom } = context;
      const handler = mockRoom.registerTextStreamHandler.mock.calls[0][1];
      const received: Record<string, unknown>[] = [];
      liveKitManager.on('messageReceived', (m) => received.push(m));

      await handler(makeTextReader(['hi'], 's2'), { identity: 'local-user' });

      expect(received.at(-1)?.role).toBe('user');
    });

    test('emits the dedicated chatMessageReceived event for chat streams', async () => {
      const { liveKitManager, mockRoom } = context;
      const handler = mockRoom.registerTextStreamHandler.mock.calls[0][1];
      const chatMessages: Record<string, unknown>[] = [];
      liveKitManager.on('chatMessageReceived', (m) => chatMessages.push(m));

      await handler(makeTextReader(['Hel', 'lo'], 'stream-1'), {
        identity: 'agent-1',
      });

      expect(
        chatMessages.map((m) => ({ text: m.text, isFinal: m.isFinal }))
      ).toEqual([
        { text: 'Hel', isFinal: false },
        { text: 'Hello', isFinal: false },
        { text: 'Hello', isFinal: true },
      ]);
      expect(chatMessages.at(-1)?.id).toBe('stream-1');
      expect(chatMessages.at(-1)?.role).toBe('agent');
    });

    test('does NOT emit chatMessageReceived for voice transcriptions', () => {
      const { liveKitManager } = context;
      const chatSpy = jest.fn();
      const messageSpy = jest.fn();
      liveKitManager.on('chatMessageReceived', chatSpy);
      liveKitManager.on('messageReceived', messageSpy);

      liveKitManager.toolRegistry.handleTranscriptionReceived(
        [{ id: 'seg-1', text: 'spoken words', final: true }],
        'agent-1'
      );

      // Transcription still drives messageReceived, but never the chat event.
      expect(messageSpy).toHaveBeenCalled();
      expect(chatSpy).not.toHaveBeenCalled();
    });
  });

  describe('chat-only lk.transcription text stream', () => {
    const makeTextReader = (chunks: string[], id: string) => ({
      info: { id },
      *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    const registeredTopics = (room: ReturnType<typeof createMockRoom>) =>
      room.registerTextStreamHandler.mock.calls.map((c) => c[0]);

    test('chat-only registers handlers on both lk.chat and lk.transcription', () => {
      const room = createMockRoom();
      const registry = new LiveKitToolRegistry([], false, true);
      registry.setRoom(room as never);

      expect(registeredTopics(room)).toEqual(
        expect.arrayContaining(['lk.chat', 'lk.transcription'])
      );
    });

    test('voice session does NOT register the lk.transcription handler', () => {
      const room = createMockRoom();
      const registry = new LiveKitToolRegistry([], false, false);
      registry.setRoom(room as never);

      const topics = registeredTopics(room);
      expect(topics).toContain('lk.chat');
      expect(topics).not.toContain('lk.transcription');
    });

    test('emits chatMessageReceived from the lk.transcription stream', async () => {
      const room = createMockRoom();
      const registry = new LiveKitToolRegistry([], false, true);
      const chatMessages: Record<string, unknown>[] = [];
      registry.on('chatMessageReceived', (m) => chatMessages.push(m));
      registry.setRoom(room as never);

      const call = room.registerTextStreamHandler.mock.calls.find(
        (c) => c[0] === 'lk.transcription'
      );
      const handler = call?.[1] as (
        reader: unknown,
        info: { identity: string }
      ) => Promise<void>;
      await handler(makeTextReader(['Hi ', 'there'], 't1'), {
        identity: 'agent-x',
      });

      expect(chatMessages.at(-1)).toMatchObject({
        id: 't1',
        role: 'agent',
        text: 'Hi there',
        isFinal: true,
      });
    });
  });
});
