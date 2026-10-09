/**
 * LiveKit Manager - Connection Management Tests
 *
 * Tests for room connection, disconnection, and connection state management.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { RoomEvent } from 'livekit-client';
import LiveKitManager from '../../src/classes/livekit-manager';
import { extractEventHandler } from '../utils/livekit-mocks';
import {
  setupTest,
  type TestContext,
  verifyRoomConfiguration,
  verifyRoomEventListeners,
} from './shared-setup';

describe('LiveKitManager - Connection Management', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  describe('Constructor', () => {
    test('should initialize with correct parameters', () => {
      const { liveKitManager, mockUrl, mockToken, mockTools } = context;

      expect(liveKitManager.lkUrl).toBe(mockUrl);
      expect(liveKitManager.accessToken).toBe(mockToken);
      expect(liveKitManager.tools).toBe(mockTools);
      expect(liveKitManager.isConnected).toBe(false);
      const DEFAULT_VOLUME = 1.0;
      expect(liveKitManager.volume).toBe(DEFAULT_VOLUME);
      expect(liveKitManager.isPaused).toBe(false);
    });

    test('should create Room with correct configuration', () => {
      verifyRoomConfiguration();
    });

    test('should set up room event listeners', () => {
      const { mockRoom } = context;
      verifyRoomEventListeners(mockRoom);
    });
  });

  describe('Connection Operations', () => {
    test('should connect successfully', async () => {
      const { liveKitManager, mockRoom, mockUrl, mockToken } = context;
      const connectedSpy = jest.fn();
      liveKitManager.on('connected', connectedSpy);

      await liveKitManager.connect();

      expect(mockRoom.prepareConnection).toHaveBeenCalledWith(
        mockUrl,
        mockToken
      );
      expect(mockRoom.connect).toHaveBeenCalledWith(mockUrl, mockToken, {
        maxRetries: 3,
      });
    });

    test('should handle connection errors', async () => {
      const { liveKitManager, mockRoom } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      const connectionError = new Error('Connection failed');
      mockRoom.connect.mockRejectedValue(connectionError);

      await liveKitManager.connect();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('LiveKit connection failed'),
        })
      );
    });

    test('should not connect if already connected', async () => {
      const { liveKitManager } = context;

      // Set the connection module's state
      liveKitManager.connection.isConnected = true;
      await liveKitManager.connect();

      // Should return early without attempting connection
      expect(liveKitManager.connection.isConnected).toBe(true);
    });

    test('should disconnect successfully', async () => {
      const { liveKitManager, mockRoom } = context;
      liveKitManager.connection.isConnected = true;

      await liveKitManager.disconnect();

      expect(mockRoom.disconnect).toHaveBeenCalled();
    });

    test('should handle disconnection errors', async () => {
      const { liveKitManager, mockRoom } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      const disconnectionError = new Error('Disconnection failed');
      mockRoom.disconnect.mockRejectedValue(disconnectionError);
      liveKitManager.connection.isConnected = true;

      await liveKitManager.disconnect();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('LiveKit disconnection failed'),
        })
      );
    });
  });

  describe('Connection State Management', () => {
    test('should properly track connection state', () => {
      const { liveKitManager } = context;

      expect(liveKitManager.isConnected).toBe(false);

      // Simulate connection
      liveKitManager.connection.isConnected = true;
      expect(liveKitManager.isConnected).toBe(true);

      // Simulate disconnection
      liveKitManager.connection.isConnected = false;
      expect(liveKitManager.isConnected).toBe(false);
    });

    test('should handle multiple connection attempts', async () => {
      const { liveKitManager, mockRoom } = context;

      // First connection
      await liveKitManager.connect();
      expect(mockRoom.connect).toHaveBeenCalledTimes(1);

      // Second connection attempt while already connected
      liveKitManager.connection.isConnected = true;
      await liveKitManager.connect();
      // Should not call connect again
      expect(mockRoom.connect).toHaveBeenCalledTimes(1);
    });

    test('should handle reconnection after disconnect', async () => {
      const { liveKitManager, mockRoom } = context;

      // Connect
      await liveKitManager.connect();
      liveKitManager.connection.isConnected = true;

      // Disconnect
      await liveKitManager.disconnect();
      liveKitManager.connection.isConnected = false;

      // Reconnect
      await liveKitManager.connect();

      expect(mockRoom.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Microphone on connect', () => {
    test('enables the microphone on connect for a voice session', async () => {
      const { mockRoom } = context;
      mockRoom.on.mockClear();
      mockRoom.localParticipant.setMicrophoneEnabled.mockClear();

      // Room is globally mocked to return context.mockRoom
      const _manager = new LiveKitManager('ws://x', 'token', [], {
        isChatOnly: false,
      });
      const connectedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.Connected
      );
      await connectedHandler?.();

      expect(
        mockRoom.localParticipant.setMicrophoneEnabled
      ).toHaveBeenCalledWith(true);
    });

    test('does NOT enable the microphone on connect for a chat-only session', async () => {
      const { mockRoom } = context;
      mockRoom.on.mockClear();
      mockRoom.localParticipant.setMicrophoneEnabled.mockClear();

      const _manager = new LiveKitManager('ws://x', 'token', [], {
        isChatOnly: true,
      });
      const connectedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.Connected
      );
      await connectedHandler?.();

      expect(
        mockRoom.localParticipant.setMicrophoneEnabled
      ).not.toHaveBeenCalled();
    });
  });
});
