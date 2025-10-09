/**
 * LiveKit Manager - Event Handling Tests
 *
 * Tests for room event handling, data processing, event forwarding,
 * and custom event generation.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { TEST_DATA } from '../utils/test-constants';
import {
  createMockDataPayload,
  createMockInfoPayload,
  extractEventHandler,
  RoomEvent,
  setupTest,
  type TestContext,
} from './shared-setup';

describe('LiveKitManager - Event Handling', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  describe('Room Event Processing', () => {
    test('should handle connected event', async () => {
      const { liveKitManager, mockRoom } = context;
      const connectedSpy = jest.fn();
      const localAudioSpy = jest.fn();
      liveKitManager.on('connected', connectedSpy);
      liveKitManager.on('localAudioStreamAvailable', localAudioSpy);

      // Simulate connected event
      const connectedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.Connected
      );
      await connectedHandler?.();

      expect(liveKitManager.isConnected).toBe(true);
      expect(
        mockRoom.localParticipant.setMicrophoneEnabled
      ).toHaveBeenCalledWith(true);
      expect(connectedSpy).toHaveBeenCalled();
    });

    test('should handle disconnected event', () => {
      const { liveKitManager, mockRoom } = context;
      const disconnectedSpy = jest.fn();
      liveKitManager.on('disconnected', disconnectedSpy);
      liveKitManager.connection.isConnected = true;

      // Simulate disconnected event
      const disconnectedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.Disconnected
      );
      disconnectedHandler?.();

      expect(liveKitManager.isConnected).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('Data Received Event Processing', () => {
    test('should handle transcription messages', () => {
      const { liveKitManager, mockRoom } = context;
      const transcriptionSpy = jest.fn();
      liveKitManager.on('transcriptionReceived', transcriptionSpy);

      // Simulate data received event
      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test transcription message
      const transcriptionPayload = createMockDataPayload(
        'transcription',
        TEST_DATA.TRANSCRIPTION
      );
      dataReceivedHandler?.(transcriptionPayload, {});

      expect(transcriptionSpy).toHaveBeenCalledWith(TEST_DATA.TRANSCRIPTION);
    });

    test('should handle answer messages', () => {
      const { liveKitManager, mockRoom } = context;
      const answerSpy = jest.fn();
      liveKitManager.on('answerReceived', answerSpy);

      // Simulate data received event
      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test answer message
      const answerPayload = createMockDataPayload('answer', TEST_DATA.ANSWER);
      dataReceivedHandler?.(answerPayload, {});

      expect(answerSpy).toHaveBeenCalledWith(TEST_DATA.ANSWER);
    });

    test('should handle custom info events', () => {
      const { liveKitManager, mockRoom } = context;
      const customEventSpy = jest.fn();
      liveKitManager.on('customEvent', customEventSpy);

      // Simulate data received event
      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test custom event (info message)
      const infoPayload = createMockInfoPayload('info', {
        status: 'processing',
      });
      dataReceivedHandler?.(infoPayload, {});

      expect(customEventSpy).toHaveBeenCalledWith(
        'info',
        { status: 'processing' },
        expect.objectContaining({
          timestamp: expect.any(Number),
          participant: 'unknown',
        })
      );
    });

    test('should handle malformed data gracefully', () => {
      const { liveKitManager, mockRoom } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Simulate data received event
      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test with malformed data
      const BYTE_ZERO = 0;
      const BYTE_ONE = 1;
      const BYTE_TWO = 2;
      const BYTE_THREE = 3;
      const malformedPayload = new Uint8Array([
        BYTE_ZERO,
        BYTE_ONE,
        BYTE_TWO,
        BYTE_THREE,
      ]); // Invalid JSON

      // Should not throw, but might emit error or ignore silently
      expect(() => {
        dataReceivedHandler?.(malformedPayload, {});
      }).not.toThrow();
    });

    test('should handle empty payloads', () => {
      const { mockRoom } = context;

      // Simulate data received event
      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test with empty payload
      const emptyPayload = new Uint8Array([]);

      // Should not throw
      expect(() => {
        dataReceivedHandler?.(emptyPayload, {});
      }).not.toThrow();
    });
  });

  describe('Event Forwarding', () => {
    test('should forward events with correct data structures', () => {
      const { liveKitManager, mockRoom } = context;
      const transcriptionSpy = jest.fn();
      const answerSpy = jest.fn();
      const customEventSpy = jest.fn();

      liveKitManager.on('transcriptionReceived', transcriptionSpy);
      liveKitManager.on('answerReceived', answerSpy);
      liveKitManager.on('customEvent', customEventSpy);

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test that event data is passed through unchanged
      const testTranscription = 'Hello world';
      const testAnswer = 'AI response';
      const testInfo = { status: 'processing', data: { progress: 50 } };

      dataReceivedHandler?.(
        createMockDataPayload('transcription', testTranscription),
        {}
      );
      dataReceivedHandler?.(createMockDataPayload('answer', testAnswer), {});
      dataReceivedHandler?.(createMockInfoPayload('info', testInfo), {});

      expect(transcriptionSpy).toHaveBeenCalledWith(testTranscription);
      expect(answerSpy).toHaveBeenCalledWith(testAnswer);
      expect(customEventSpy).toHaveBeenCalledWith(
        'info',
        testInfo,
        expect.objectContaining({
          timestamp: expect.any(Number),
          participant: 'unknown',
        })
      );
    });

    test('should maintain event timing information', () => {
      const { liveKitManager, mockRoom } = context;
      const infoSpy = jest.fn();
      liveKitManager.on('customEvent', infoSpy);

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      const beforeTime = Date.now();
      const infoPayload = createMockInfoPayload('info', { test: 'data' });
      dataReceivedHandler?.(infoPayload, {});
      const afterTime = Date.now();

      expect(infoSpy).toHaveBeenCalledWith(
        'info',
        { test: 'data' },
        expect.objectContaining({
          timestamp: expect.any(Number),
          participant: 'unknown',
        })
      );

      // Verify timestamp is reasonable
      const callArgs = infoSpy.mock.calls[0];
      const metadata = callArgs[2];
      expect(metadata.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(metadata.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Event Error Handling', () => {
    test('should handle event listener errors gracefully', () => {
      const { liveKitManager, mockRoom } = context;

      // Add event listener that throws
      liveKitManager.on('transcriptionReceived', () => {
        throw new Error('Listener error');
      });

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );
      const transcriptionPayload = createMockDataPayload(
        'transcription',
        'test'
      );

      // Should not crash the entire event handling system
      expect(() => {
        dataReceivedHandler?.(transcriptionPayload, {});
      }).not.toThrow();
    });

    test('should handle missing event handlers', () => {
      const { mockRoom } = context;

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Send events without any listeners registered
      const transcriptionPayload = createMockDataPayload(
        'transcription',
        'test'
      );
      const answerPayload = createMockDataPayload('answer', 'test');

      expect(() => {
        dataReceivedHandler?.(transcriptionPayload, {});
        dataReceivedHandler?.(answerPayload, {});
      }).not.toThrow();
    });
  });

  describe('Custom Event Generation', () => {
    test('should generate appropriate metadata for custom events', () => {
      const { liveKitManager, mockRoom } = context;
      const customEventSpy = jest.fn();
      liveKitManager.on('customEvent', customEventSpy);

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test custom event generation
      const customPayload = createMockInfoPayload('custom', { custom: 'data' });
      dataReceivedHandler?.(customPayload, {});

      expect(customEventSpy).toHaveBeenCalledWith(
        'custom',
        { custom: 'data' },
        expect.objectContaining({
          timestamp: expect.any(Number),
          participant: 'unknown',
        })
      );
    });

    test('should handle different event types consistently', () => {
      const { liveKitManager, mockRoom } = context;
      const eventSpy = jest.fn();
      liveKitManager.on('customEvent', eventSpy);

      const dataReceivedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.DataReceived
      );

      // Test multiple different event types
      const eventTypes = ['status', 'progress', 'warning', 'debug'];

      eventTypes.forEach((eventType, index) => {
        const payload = createMockInfoPayload(eventType, { index });
        dataReceivedHandler?.(payload, {});
      });

      expect(eventSpy).toHaveBeenCalledTimes(eventTypes.length);

      // Verify each event was processed correctly
      eventTypes.forEach((eventType, index) => {
        expect(eventSpy).toHaveBeenNthCalledWith(
          index + 1,
          eventType,
          { index },
          expect.any(Object)
        );
      });
    });
  });
});
