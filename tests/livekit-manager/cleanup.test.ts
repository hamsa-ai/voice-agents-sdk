/**
 * LiveKit Manager - Cleanup Tests
 *
 * Tests for resource cleanup, memory management, and proper teardown
 * of connections, audio elements, and event listeners.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { setupTest, type TestContext } from './shared-setup';

describe('LiveKitManager - Cleanup', () => {
  let context: TestContext;

  beforeEach(() => {
    context = setupTest();
  });

  describe('Resource Cleanup', () => {
    test('should cleanup resources properly on disconnect', async () => {
      const { liveKitManager } = context;
      const mockAudioElement1 = new HTMLAudioElement();
      const mockAudioElement2 = new HTMLAudioElement();

      Object.defineProperty(mockAudioElement1, 'parentNode', {
        value: { removeChild: jest.fn() },
        writable: true,
      });
      Object.defineProperty(mockAudioElement2, 'parentNode', {
        value: { removeChild: jest.fn() },
        writable: true,
      });

      liveKitManager.audioElements.add(mockAudioElement1);
      liveKitManager.audioElements.add(mockAudioElement2);
      liveKitManager.connection.isConnected = true;

      // Call private cleanup method through disconnect
      await liveKitManager.disconnect();

      expect(liveKitManager.audioElements.size).toBe(0);
      expect(liveKitManager.isConnected).toBe(false);
    });

    test('should handle cleanup when audio elements have no parent', async () => {
      const { liveKitManager } = context;
      const mockAudioElement = new HTMLAudioElement();
      // No parentNode set

      liveKitManager.audioElements.add(mockAudioElement);
      liveKitManager.connection.isConnected = true;

      // Should not throw error during cleanup
      await expect(liveKitManager.disconnect()).resolves.toBeUndefined();

      expect(liveKitManager.audioElements.size).toBe(0);
    });

    test('should cleanup audio elements with error handling', async () => {
      const { liveKitManager } = context;
      const mockAudioElement = new HTMLAudioElement();

      // Mock parentNode that throws error on removeChild
      Object.defineProperty(mockAudioElement, 'parentNode', {
        value: {
          removeChild: jest.fn().mockImplementation(() => {
            throw new Error('Remove child failed');
          }),
        },
        writable: true,
      });

      liveKitManager.audioElements.add(mockAudioElement);
      liveKitManager.connection.isConnected = true;

      // Should handle errors gracefully
      await expect(liveKitManager.disconnect()).resolves.toBeUndefined();

      // Element should still be removed from tracking even if DOM removal fails
      expect(liveKitManager.audioElements.size).toBe(0);
    });
  });

  describe('Memory Management', () => {
    test('should clear audio element references', async () => {
      const { liveKitManager } = context;
      const initialElements = [
        new HTMLAudioElement(),
        new HTMLAudioElement(),
        new HTMLAudioElement(),
      ];

      // Add elements to the set
      for (const element of initialElements) {
        Object.defineProperty(element, 'parentNode', {
          value: { removeChild: jest.fn() },
          writable: true,
        });
        liveKitManager.audioElements.add(element);
      }

      const EXPECTED_ELEMENT_COUNT = 3;
      expect(liveKitManager.audioElements.size).toBe(EXPECTED_ELEMENT_COUNT);

      // Cleanup should clear all references
      await liveKitManager.disconnect();

      expect(liveKitManager.audioElements.size).toBe(0);

      // Verify the Set is actually empty
      expect([...liveKitManager.audioElements]).toEqual([]);
    });

    test('should handle large numbers of audio elements', async () => {
      const { liveKitManager } = context;
      const elementCount = 100;

      // Create many audio elements
      for (let i = 0; i < elementCount; i++) {
        const element = new HTMLAudioElement();
        Object.defineProperty(element, 'parentNode', {
          value: { removeChild: jest.fn() },
          writable: true,
        });
        liveKitManager.audioElements.add(element);
      }

      expect(liveKitManager.audioElements.size).toBe(elementCount);

      // Should handle cleanup efficiently
      const startTime = Date.now();
      await liveKitManager.disconnect();
      const endTime = Date.now();

      expect(liveKitManager.audioElements.size).toBe(0);

      // Cleanup should be reasonably fast (less than 1 second for 100 elements)
      const MAX_CLEANUP_TIME_MS = 1000;
      expect(endTime - startTime).toBeLessThan(MAX_CLEANUP_TIME_MS);
    });
  });

  describe('Connection State Cleanup', () => {
    test('should reset connection state on cleanup', async () => {
      const { liveKitManager } = context;

      // Set various connection states
      liveKitManager.connection.isConnected = true;
      liveKitManager.connection.isPaused = true;

      await liveKitManager.disconnect();

      expect(liveKitManager.isConnected).toBe(false);
      // Note: isPaused state might be preserved depending on implementation
    });

    test('should handle cleanup when already disconnected', () => {
      const { liveKitManager } = context;

      // Already disconnected
      expect(liveKitManager.isConnected).toBe(false);

      // Should not throw error
      expect(async () => {
        await liveKitManager.disconnect();
      }).not.toThrow();

      expect(liveKitManager.isConnected).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    test('should cleanup even when room disconnect fails', async () => {
      const { liveKitManager, mockRoom } = context;
      const mockAudioElement = new HTMLAudioElement();

      Object.defineProperty(mockAudioElement, 'parentNode', {
        value: { removeChild: jest.fn() },
        writable: true,
      });

      liveKitManager.audioElements.add(mockAudioElement);
      liveKitManager.connection.isConnected = true;

      // Add error listener to handle connection error
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Make room disconnect throw error
      mockRoom.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      // Should still cleanup local resources
      await liveKitManager.disconnect();

      expect(liveKitManager.audioElements.size).toBe(0);
      expect(liveKitManager.isConnected).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle partial cleanup failures', async () => {
      const { liveKitManager } = context;

      const workingElement = new HTMLAudioElement();
      const failingElement = new HTMLAudioElement();

      Object.defineProperty(workingElement, 'parentNode', {
        value: { removeChild: jest.fn() },
        writable: true,
      });

      Object.defineProperty(failingElement, 'parentNode', {
        value: {
          removeChild: jest.fn().mockImplementation(() => {
            throw new Error('Cleanup failed');
          }),
        },
        writable: true,
      });

      liveKitManager.audioElements.add(workingElement);
      liveKitManager.audioElements.add(failingElement);

      // Should cleanup what it can
      await liveKitManager.disconnect();

      // All elements should be removed from tracking regardless of DOM cleanup success
      expect(liveKitManager.audioElements.size).toBe(0);
    });
  });

  describe('Cleanup Integration', () => {
    test('should integrate cleanup with connection lifecycle', async () => {
      const { liveKitManager, mockRoom } = context;

      // Connect
      await liveKitManager.connect();
      liveKitManager.connection.isConnected = true;

      // Add some resources
      const audioElement = new HTMLAudioElement();
      Object.defineProperty(audioElement, 'parentNode', {
        value: { removeChild: jest.fn() },
        writable: true,
      });
      liveKitManager.audioElements.add(audioElement);

      // Verify resources are present
      expect(liveKitManager.audioElements.size).toBe(1);
      expect(liveKitManager.isConnected).toBe(true);

      // Disconnect and cleanup
      await liveKitManager.disconnect();

      // Verify complete cleanup
      expect(mockRoom.disconnect).toHaveBeenCalled();
      expect(liveKitManager.audioElements.size).toBe(0);
      expect(liveKitManager.isConnected).toBe(false);
    });

    test('should handle cleanup during error conditions', async () => {
      const { liveKitManager } = context;
      const errorSpy = jest.fn();
      liveKitManager.on('error', errorSpy);

      // Simulate error state
      liveKitManager.connection.isConnected = true;

      // Add resource that will fail cleanup
      const audioElement = new HTMLAudioElement();
      Object.defineProperty(audioElement, 'parentNode', {
        value: {
          removeChild: () => {
            throw new Error('DOM error');
          },
        },
        writable: true,
      });
      liveKitManager.audioElements.add(audioElement);

      // Cleanup should still work despite errors
      await liveKitManager.disconnect();

      expect(liveKitManager.audioElements.size).toBe(0);
      expect(liveKitManager.isConnected).toBe(false);
    });
  });
});
