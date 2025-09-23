/**
 * LiveKit Manager - Audio Management Tests
 *
 * Tests for audio track handling, volume control, pause/resume functionality,
 * and audio element management.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { VOLUMES } from '../utils/test-constants';
import {
  createMockAudioTrack,
  extractEventHandler,
  RoomEvent,
  setupTest,
  type TestContext,
  Track,
} from './shared-setup';

describe('LiveKitManager - Audio Management', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  describe('Audio Track Handling', () => {
    test('should handle track subscribed event for audio', () => {
      const { liveKitManager, mockRoom } = context;
      const remoteAudioSpy = jest.fn();
      liveKitManager.on('trackSubscribed', remoteAudioSpy);

      const mockTrack = createMockAudioTrack();

      // Simulate track subscribed event
      const trackSubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackSubscribed
      );
      trackSubscribedHandler?.(mockTrack, {}, {});

      expect(mockTrack.attach).toHaveBeenCalled();
      expect(remoteAudioSpy).toHaveBeenCalled();
    });

    test('should handle track unsubscribed event', () => {
      const { mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();
      Object.defineProperty(mockAudioElement, 'parentNode', {
        value: document.body,
        writable: true,
        configurable: true,
      });

      const mockTrack = {
        kind: Track.Kind.Audio,
        detach: jest.fn().mockReturnValue([mockAudioElement]),
      };

      // Simulate track unsubscribed event
      const trackUnsubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackUnsubscribed
      );
      trackUnsubscribedHandler?.(mockTrack, {}, {});

      expect(mockTrack.detach).toHaveBeenCalled();
    });

    test('should setup audio monitoring for speaking/listening events', () => {
      const { liveKitManager, mockRoom } = context;
      const speakingSpy = jest.fn();
      const listeningSpy = jest.fn();
      liveKitManager.on('speaking', speakingSpy);
      liveKitManager.on('listening', listeningSpy);

      const mockAudioElement = new HTMLAudioElement();
      const mockTrack = createMockAudioTrack();
      mockTrack.attach = jest.fn().mockReturnValue(mockAudioElement);

      // Simulate track subscribed event
      const trackSubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackSubscribed
      );
      trackSubscribedHandler?.(mockTrack, {}, {});

      // Verify event listeners were added
      expect(mockAudioElement.addEventListener).toHaveBeenCalledWith(
        'play',
        expect.any(Function)
      );
      expect(mockAudioElement.addEventListener).toHaveBeenCalledWith(
        'pause',
        expect.any(Function)
      );
      expect(mockAudioElement.addEventListener).toHaveBeenCalledWith(
        'ended',
        expect.any(Function)
      );

      // Test play event triggers speaking
      const playHandler = (
        mockAudioElement.addEventListener as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'play')[1];
      playHandler();
      expect(speakingSpy).toHaveBeenCalled();

      // Test pause event triggers listening
      const pauseHandler = (
        mockAudioElement.addEventListener as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'pause')[1];
      pauseHandler();
      expect(listeningSpy).toHaveBeenCalled();
    });
  });

  describe('Volume Control', () => {
    test('should set volume correctly', () => {
      const { liveKitManager } = context;
      const mockAudioElement1 = new HTMLAudioElement();
      const mockAudioElement2 = new HTMLAudioElement();

      liveKitManager.audioElements.add(mockAudioElement1);
      liveKitManager.audioElements.add(mockAudioElement2);

      liveKitManager.setVolume(VOLUMES.HALF);

      expect(liveKitManager.volume).toBe(VOLUMES.HALF);
      expect(mockAudioElement1.volume).toBe(VOLUMES.HALF);
      expect(mockAudioElement2.volume).toBe(VOLUMES.HALF);
    });

    test('should clamp volume between 0.0 and 1.0', () => {
      const { liveKitManager } = context;

      liveKitManager.setVolume(VOLUMES.BELOW_MIN);
      expect(liveKitManager.volume).toBe(VOLUMES.MIN);

      liveKitManager.setVolume(VOLUMES.ABOVE_MAX);
      expect(liveKitManager.volume).toBe(VOLUMES.DEFAULT);
    });

    test('should handle volume setting errors', () => {
      const { liveKitManager } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Mock audio element that throws error when volume is set
      const mockAudioElement = {
        get volume() {
          return VOLUMES.HALF;
        },
        set volume(_val) {
          throw new Error('Volume setting failed');
        },
      };

      // Add the mock element to the audio manager directly
      liveKitManager.audioManager.audioElements.add(
        mockAudioElement as HTMLAudioElement
      );

      // This should trigger the error
      liveKitManager.setVolume(VOLUMES.HIGHER);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to set volume'),
        })
      );
    });

    test('should apply volume to new audio elements', () => {
      const { liveKitManager, mockRoom } = context;
      liveKitManager.setVolume(VOLUMES.CUSTOM);

      const mockAudioElement = new HTMLAudioElement();
      const mockTrack = createMockAudioTrack();
      mockTrack.attach = jest.fn().mockReturnValue(mockAudioElement);

      // Simulate track subscribed event
      const trackSubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackSubscribed
      );
      trackSubscribedHandler?.(mockTrack, {}, {});

      expect(mockAudioElement.volume).toBe(VOLUMES.CUSTOM);
    });
  });

  describe('Pause and Resume', () => {
    test('should pause correctly', () => {
      const { liveKitManager, mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();
      liveKitManager.audioElements.add(mockAudioElement);

      liveKitManager.pause();

      expect(liveKitManager.isPaused).toBe(true);
      expect(
        mockRoom.localParticipant.setMicrophoneEnabled
      ).toHaveBeenCalledWith(false);
      expect(mockAudioElement.pause).toHaveBeenCalled();
    });

    test('should resume correctly', () => {
      const { liveKitManager, mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();
      liveKitManager.audioElements.add(mockAudioElement);
      liveKitManager.connection.isPaused = true;

      liveKitManager.resume();

      expect(liveKitManager.isPaused).toBe(false);
      expect(
        mockRoom.localParticipant.setMicrophoneEnabled
      ).toHaveBeenCalledWith(true);
      expect(mockAudioElement.play).toHaveBeenCalled();
    });

    test('should handle pause errors', () => {
      const { liveKitManager, mockRoom } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Mock room that throws error
      mockRoom.localParticipant.setMicrophoneEnabled.mockImplementation(() => {
        throw new Error('Microphone error');
      });

      liveKitManager.pause();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to pause call'),
        })
      );
    });

    test('should handle resume errors', () => {
      const { liveKitManager, mockRoom } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Mock room that throws error
      mockRoom.localParticipant.setMicrophoneEnabled.mockImplementation(() => {
        throw new Error('Microphone error');
      });

      liveKitManager.resume();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to resume call'),
        })
      );
    });
  });

  describe('Audio Element Management', () => {
    test('should track audio elements correctly', () => {
      const { liveKitManager, mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();
      const mockTrack = createMockAudioTrack();
      mockTrack.attach = jest.fn().mockReturnValue(mockAudioElement);

      expect(liveKitManager.audioElements.size).toBe(0);

      // Simulate track subscribed event
      const trackSubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackSubscribed
      );
      trackSubscribedHandler?.(mockTrack, {}, {});

      expect(liveKitManager.audioElements.size).toBe(1);
      expect(liveKitManager.audioElements.has(mockAudioElement)).toBe(true);
    });

    test('should clean up audio elements on track unsubscribed', () => {
      const { liveKitManager, mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();
      Object.defineProperty(mockAudioElement, 'parentNode', {
        value: document.body,
        writable: true,
        configurable: true,
      });

      liveKitManager.audioElements.add(mockAudioElement);
      expect(liveKitManager.audioElements.size).toBe(1);

      const mockTrack = {
        kind: Track.Kind.Audio,
        detach: jest.fn().mockReturnValue([mockAudioElement]),
      };

      // Simulate track unsubscribed event
      const trackUnsubscribedHandler = extractEventHandler(
        mockRoom,
        RoomEvent.TrackUnsubscribed
      );
      trackUnsubscribedHandler?.(mockTrack, {}, {});

      // Audio element should be removed from tracking
      expect(liveKitManager.audioElements.size).toBe(0);
    });
  });
});
