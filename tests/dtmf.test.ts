import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import HamsaVoiceAgent from '../src/main';
import { mockSuccessfulConversationInit } from './utils/fetch-mocks';
import { MOCK_CONFIG } from './utils/test-constants';
import {
  applyWakeLockMocks,
  createWakeLockMocks,
} from './utils/wake-lock-mocks';

describe('HamsaVoiceAgent DTMF Support', () => {
  let voiceAgent: HamsaVoiceAgent;
  const mockApiKey = MOCK_CONFIG.API_KEY;
  const mockConfig = {
    API_URL: MOCK_CONFIG.API_URL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessfulConversationInit();
    voiceAgent = new HamsaVoiceAgent(mockApiKey, mockConfig);
  });

  describe('sendDTMF method', () => {
    test('should have sendDTMF method available', () => {
      expect(typeof voiceAgent.sendDTMF).toBe('function');
    });

    test('should throw error when not connected', () => {
      expect(() => voiceAgent.sendDTMF('1')).toThrow(
        'Cannot send DTMF: not connected to voice agent. Call start() first.'
      );
    });

    test('should throw error for invalid DTMF digit - letter', () => {
      expect(() => voiceAgent.sendDTMF('a' as any)).toThrow(
        'Invalid DTMF digit: "a". Valid digits are 0-9, *, and #.'
      );
    });

    test('should throw error for invalid DTMF digit - empty string', () => {
      expect(() => voiceAgent.sendDTMF('' as any)).toThrow(
        'Invalid DTMF digit: "". Valid digits are 0-9, *, and #.'
      );
    });

    test('should throw error for invalid DTMF digit - multiple digits', () => {
      expect(() => voiceAgent.sendDTMF('12' as any)).toThrow(
        'Invalid DTMF digit: "12". Valid digits are 0-9, *, and #.'
      );
    });

    test('should throw error for invalid DTMF digit - special character', () => {
      expect(() => voiceAgent.sendDTMF('@' as any)).toThrow(
        'Invalid DTMF digit: "@". Valid digits are 0-9, *, and #.'
      );
    });

    describe('when connected', () => {
      let mockPublishData: jest.Mock;
      let mockRoom: any;

      beforeEach(async () => {
        // Mock wake lock
        const wakeLockMocks = createWakeLockMocks();
        applyWakeLockMocks(voiceAgent, wakeLockMocks);

        // Start the agent to initialize liveKitManager
        await voiceAgent.start({
          agentId: 'test-agent',
          params: {},
          voiceEnablement: true,
          tools: [],
        });

        // Set up mock room with publishData method
        mockPublishData = jest.fn();
        mockRoom = {
          localParticipant: {
            publishData: mockPublishData,
          },
        };

        // Mock the connection and room
        if (voiceAgent.liveKitManager) {
          voiceAgent.liveKitManager.connection.isConnected = true;
          voiceAgent.liveKitManager.connection.room = mockRoom;
        }
      });

      test('should send valid DTMF digit "1"', () => {
        voiceAgent.sendDTMF('1');

        expect(mockPublishData).toHaveBeenCalledTimes(1);
        const [data, options] = mockPublishData.mock.calls[0] as [
          Uint8Array,
          { reliable: boolean; topic: string },
        ];

        // Verify options
        expect(options).toEqual({
          reliable: true,
          topic: 'dtmf',
        });

        // Verify data content
        const decoded = new TextDecoder().decode(data);
        const message = JSON.parse(decoded);
        expect(message.event).toBe('dtmf');
        expect(message.content).toBe('1');
        expect(typeof message.timestamp).toBe('number');
      });

      test('should send valid DTMF digit "0"', () => {
        voiceAgent.sendDTMF('0');

        const [data] = mockPublishData.mock.calls[0] as [Uint8Array];
        const decoded = new TextDecoder().decode(data);
        const message = JSON.parse(decoded);
        expect(message.content).toBe('0');
      });

      test('should send valid DTMF digit "*"', () => {
        voiceAgent.sendDTMF('*');

        const [data] = mockPublishData.mock.calls[0] as [Uint8Array];
        const decoded = new TextDecoder().decode(data);
        const message = JSON.parse(decoded);
        expect(message.content).toBe('*');
      });

      test('should send valid DTMF digit "#"', () => {
        voiceAgent.sendDTMF('#');

        const [data] = mockPublishData.mock.calls[0] as [Uint8Array];
        const decoded = new TextDecoder().decode(data);
        const message = JSON.parse(decoded);
        expect(message.content).toBe('#');
      });

      test('should send all numeric DTMF digits correctly', () => {
        const digits = [
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
        ] as const;

        for (const digit of digits) {
          mockPublishData.mockClear();
          voiceAgent.sendDTMF(digit);

          expect(mockPublishData).toHaveBeenCalledTimes(1);
          const [data] = mockPublishData.mock.calls[0] as [Uint8Array];
          const decoded = new TextDecoder().decode(data);
          const message = JSON.parse(decoded);
          expect(message.content).toBe(digit);
        }
      });

      test('should handle multiple DTMF sends in quick succession', () => {
        const digitsToSend = ['1', '2', '3'] as const;
        for (const digit of digitsToSend) {
          voiceAgent.sendDTMF(digit);
        }

        expect(mockPublishData).toHaveBeenCalledTimes(digitsToSend.length);

        // Verify each call sent the correct digit
        const sentDigits = mockPublishData.mock.calls.map((call: unknown[]) => {
          const decoded = new TextDecoder().decode(call[0] as Uint8Array);
          return JSON.parse(decoded).content;
        });

        expect(sentDigits).toEqual([...digitsToSend]);
      });

      test('should include timestamp in DTMF message', () => {
        const beforeTimestamp = Date.now();
        voiceAgent.sendDTMF('5');
        const afterTimestamp = Date.now();

        const [data] = mockPublishData.mock.calls[0] as [Uint8Array];
        const decoded = new TextDecoder().decode(data);
        const message = JSON.parse(decoded);

        expect(message.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(message.timestamp).toBeLessThanOrEqual(afterTimestamp);
      });

      test('should use reliable delivery for DTMF messages', () => {
        voiceAgent.sendDTMF('9');

        const [, options] = mockPublishData.mock.calls[0] as [
          Uint8Array,
          { reliable: boolean; topic: string },
        ];
        expect(options.reliable).toBe(true);
      });

      test('should use "dtmf" topic for messages', () => {
        voiceAgent.sendDTMF('7');

        const [, options] = mockPublishData.mock.calls[0] as [
          Uint8Array,
          { reliable: boolean; topic: string },
        ];
        expect(options.topic).toBe('dtmf');
      });

      test('should emit dtmfSent event when digit is sent', () => {
        const mockListener = jest.fn();
        voiceAgent.on('dtmfSent', mockListener);

        voiceAgent.sendDTMF('3');

        expect(mockListener).toHaveBeenCalledTimes(1);
        expect(mockListener).toHaveBeenCalledWith('3');
      });
    });

    describe('edge cases', () => {
      test('should throw when liveKitManager exists but not connected', async () => {
        // Mock wake lock
        const wakeLockMocks = createWakeLockMocks();
        applyWakeLockMocks(voiceAgent, wakeLockMocks);

        // Start to create liveKitManager
        await voiceAgent.start({
          agentId: 'test-agent',
          params: {},
          voiceEnablement: true,
          tools: [],
        });

        // Mock as not connected
        if (voiceAgent.liveKitManager) {
          voiceAgent.liveKitManager.connection.isConnected = false;
        }

        expect(() => voiceAgent.sendDTMF('1')).toThrow(
          'Cannot send DTMF: not connected to voice agent. Call start() first.'
        );
      });

      test('should throw when room has no localParticipant', async () => {
        // Mock wake lock
        const wakeLockMocks = createWakeLockMocks();
        applyWakeLockMocks(voiceAgent, wakeLockMocks);

        // Start to create liveKitManager
        await voiceAgent.start({
          agentId: 'test-agent',
          params: {},
          voiceEnablement: true,
          tools: [],
        });

        // Mock connected but no localParticipant
        if (voiceAgent.liveKitManager) {
          voiceAgent.liveKitManager.connection.isConnected = true;
          voiceAgent.liveKitManager.connection.room = {
            localParticipant: null,
          } as any;
        }

        expect(() => voiceAgent.sendDTMF('1')).toThrow(
          'Cannot send DTMF: not connected to voice agent. Call start() first.'
        );
      });
    });
  });
});
