import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import HamsaVoiceAgent from '../src/main';
import { mockSuccessfulConversationInit } from './utils/fetch-mocks';
import { MOCK_CONFIG } from './utils/test-constants';
import {
  applyWakeLockMocks,
  createWakeLockMocks,
} from './utils/wake-lock-mocks';

const CHAT_TOPIC = 'lk.chat';

describe('HamsaVoiceAgent sendMessage', () => {
  let voiceAgent: HamsaVoiceAgent;
  const mockApiKey = MOCK_CONFIG.API_KEY;
  const mockConfig = { API_URL: MOCK_CONFIG.API_URL };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessfulConversationInit();
    voiceAgent = new HamsaVoiceAgent(mockApiKey, mockConfig);
  });

  test('should expose a sendMessage method', () => {
    expect(typeof voiceAgent.sendMessage).toBe('function');
  });

  describe('validation', () => {
    test('should reject when not connected', async () => {
      await expect(voiceAgent.sendMessage('hello')).rejects.toThrow(
        'Cannot send message: not connected to agent. Call start() first.'
      );
    });

    test('should reject an empty string', async () => {
      await expect(voiceAgent.sendMessage('')).rejects.toThrow(
        'Cannot send message: text must be a non-empty string.'
      );
    });

    test('should reject a whitespace-only string', async () => {
      await expect(voiceAgent.sendMessage('   ')).rejects.toThrow(
        'Cannot send message: text must be a non-empty string.'
      );
    });

    test('should reject a non-string value', async () => {
      await expect(
        voiceAgent.sendMessage(undefined as unknown as string)
      ).rejects.toThrow(
        'Cannot send message: text must be a non-empty string.'
      );
    });
  });

  describe('when connected', () => {
    let mockSendText: jest.Mock;

    beforeEach(async () => {
      const wakeLockMocks = createWakeLockMocks();
      applyWakeLockMocks(voiceAgent, wakeLockMocks);

      await voiceAgent.start({
        agentId: 'test-agent',
        params: {},
        isChatOnly: true,
      });

      mockSendText = jest.fn(() => Promise.resolve({ id: 'stream-1' }));
      const mockRoom = {
        localParticipant: { sendText: mockSendText },
      };

      if (voiceAgent.liveKitManager) {
        voiceAgent.liveKitManager.connection.isConnected = true;
        voiceAgent.liveKitManager.connection.room = mockRoom as never;
      }
    });

    test('should publish the text on the lk.chat topic', async () => {
      await voiceAgent.sendMessage('How do I reset my password?');

      expect(mockSendText).toHaveBeenCalledTimes(1);
      expect(mockSendText).toHaveBeenCalledWith('How do I reset my password?', {
        topic: CHAT_TOPIC,
      });
    });

    test('should emit messageSent after a successful send', async () => {
      const onMessageSent = jest.fn();
      voiceAgent.on('messageSent', onMessageSent);

      await voiceAgent.sendMessage('hi there');

      expect(onMessageSent).toHaveBeenCalledWith('hi there');
    });

    test('should propagate and emit error when sendText fails', async () => {
      const failure = new Error('stream failed');
      mockSendText.mockImplementation(() => Promise.reject(failure));
      const onError = jest.fn();
      const onMessageSent = jest.fn();
      voiceAgent.on('error', onError);
      voiceAgent.on('messageSent', onMessageSent);

      await expect(voiceAgent.sendMessage('boom')).rejects.toThrow(
        'stream failed'
      );
      expect(onError).toHaveBeenCalledWith(failure);
      expect(onMessageSent).not.toHaveBeenCalled();
    });
  });
});
