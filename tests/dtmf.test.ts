import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import HamsaVoiceAgent, { type DTMFDigit } from '../src/main';
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

  // RFC 4733 DTMF Codes
  const DTMF_CODE_0 = 0;
  const DTMF_CODE_1 = 1;
  const DTMF_CODE_2 = 2;
  const DTMF_CODE_3 = 3;
  const DTMF_CODE_4 = 4;
  const DTMF_CODE_5 = 5;
  const DTMF_CODE_6 = 6;
  const DTMF_CODE_7 = 7;
  const DTMF_CODE_8 = 8;
  const DTMF_CODE_9 = 9;
  const DTMF_CODE_STAR = 10;
  const DTMF_CODE_HASH = 11;

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
      let mockPublishDtmf: jest.Mock;
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

        // Set up mock room with publishDtmf method
        mockPublishDtmf = jest.fn();
        mockRoom = {
          localParticipant: {
            publishDtmf: mockPublishDtmf,
          },
        };

        // Mock the connection and room
        if (voiceAgent.liveKitManager) {
          voiceAgent.liveKitManager.connection.isConnected = true;
          voiceAgent.liveKitManager.connection.room = mockRoom;
        }
      });

      test('should send valid DTMF digit "1" with correct code', () => {
        voiceAgent.sendDTMF('1');

        expect(mockPublishDtmf).toHaveBeenCalledTimes(1);
        expect(mockPublishDtmf).toHaveBeenCalledWith(DTMF_CODE_1, '1');
      });

      test('should send valid DTMF digit "0" with correct code', () => {
        voiceAgent.sendDTMF('0');

        expect(mockPublishDtmf).toHaveBeenCalledTimes(1);
        expect(mockPublishDtmf).toHaveBeenCalledWith(DTMF_CODE_0, '0');
      });

      test('should send valid DTMF digit "*" with correct code', () => {
        voiceAgent.sendDTMF('*');

        expect(mockPublishDtmf).toHaveBeenCalledTimes(1);
        expect(mockPublishDtmf).toHaveBeenCalledWith(DTMF_CODE_STAR, '*');
      });

      test('should send valid DTMF digit "#" with correct code', () => {
        voiceAgent.sendDTMF('#');

        expect(mockPublishDtmf).toHaveBeenCalledTimes(1);
        expect(mockPublishDtmf).toHaveBeenCalledWith(DTMF_CODE_HASH, '#');
      });

      test('should send all numeric DTMF digits with correct codes', () => {
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

        const expectedCodes = [
          DTMF_CODE_0,
          DTMF_CODE_1,
          DTMF_CODE_2,
          DTMF_CODE_3,
          DTMF_CODE_4,
          DTMF_CODE_5,
          DTMF_CODE_6,
          DTMF_CODE_7,
          DTMF_CODE_8,
          DTMF_CODE_9,
        ];

        for (let i = 0; i < digits.length; i++) {
          mockPublishDtmf.mockClear();
          voiceAgent.sendDTMF(digits[i]);

          expect(mockPublishDtmf).toHaveBeenCalledTimes(1);
          expect(mockPublishDtmf).toHaveBeenCalledWith(
            expectedCodes[i],
            digits[i]
          );
        }
      });

      test('should handle multiple DTMF sends in quick succession', () => {
        const digitsToSend = ['1', '2', '3'] as const;
        const expectedCodes = [DTMF_CODE_1, DTMF_CODE_2, DTMF_CODE_3];

        for (const digit of digitsToSend) {
          voiceAgent.sendDTMF(digit);
        }

        expect(mockPublishDtmf).toHaveBeenCalledTimes(digitsToSend.length);

        // Verify each call sent the correct digit and code
        for (let i = 0; i < digitsToSend.length; i++) {
          expect(mockPublishDtmf).toHaveBeenNthCalledWith(
            i + 1,
            expectedCodes[i],
            digitsToSend[i]
          );
        }
      });

      test('should use RFC 4733 code mapping', () => {
        const testCases: [DTMFDigit, number][] = [
          ['0', DTMF_CODE_0],
          ['1', DTMF_CODE_1],
          ['2', DTMF_CODE_2],
          ['3', DTMF_CODE_3],
          ['4', DTMF_CODE_4],
          ['5', DTMF_CODE_5],
          ['6', DTMF_CODE_6],
          ['7', DTMF_CODE_7],
          ['8', DTMF_CODE_8],
          ['9', DTMF_CODE_9],
          ['*', DTMF_CODE_STAR],
          ['#', DTMF_CODE_HASH],
        ];

        for (const [digit, expectedCode] of testCases) {
          mockPublishDtmf.mockClear();
          voiceAgent.sendDTMF(digit);
          expect(mockPublishDtmf).toHaveBeenCalledWith(expectedCode, digit);
        }
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
