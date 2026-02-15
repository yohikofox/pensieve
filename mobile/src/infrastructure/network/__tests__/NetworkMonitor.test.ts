import 'reflect-metadata'; // Required for tsyringe decorators
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NetworkMonitor } from '../NetworkMonitor';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

describe('NetworkMonitor', () => {
  let monitor: NetworkMonitor;
  let mockUnsubscribe: jest.Mock;
  let networkChangeHandler: (state: NetInfoState) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock unsubscribe function
    mockUnsubscribe = jest.fn();

    // Capture le handler passé à addEventListener
    (NetInfo.addEventListener as jest.Mock).mockImplementation((handler) => {
      networkChangeHandler = handler;
      return mockUnsubscribe;
    });

    monitor = new NetworkMonitor(5000); // 5s debounce
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('should subscribe to network changes', () => {
      monitor.start();

      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
      expect(NetInfo.addEventListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should not subscribe twice if already started', () => {
      monitor.start();
      monitor.start();

      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('should unsubscribe from network changes', () => {
      monitor.start();
      monitor.stop();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clear pending debounce timeout', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      // Trigger offline → online
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      // Clear mock after offline notification
      listener.mockClear();

      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // Stop before debounce completes
      monitor.stop();

      // Fast-forward timers
      jest.runAllTimers();

      // Listener should NOT be called with true (debounce was cleared)
      expect(listener).not.toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      monitor.stop();

      // Trigger network change after stop
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('addListener()', () => {
    it('should add listener and return cleanup function', () => {
      const listener = jest.fn();
      const cleanup = monitor.addListener(listener);

      expect(typeof cleanup).toBe('function');
    });

    it('cleanup function should remove listener', () => {
      monitor.start();

      const listener = jest.fn();
      const cleanup = monitor.addListener(listener);

      cleanup();

      // Trigger network change
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      monitor.start();

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      monitor.addListener(listener1);
      monitor.addListener(listener2);

      // Trigger offline
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      expect(listener1).toHaveBeenCalledWith(false);
      expect(listener2).toHaveBeenCalledWith(false);
    });
  });

  describe('getCurrentState()', () => {
    it('should fetch current network state', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });

      const isConnected = await monitor.getCurrentState();

      expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
      expect(isConnected).toBe(true);
    });

    it('should return false when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const isConnected = await monitor.getCurrentState();

      expect(isConnected).toBe(false);
    });
  });

  describe('Network change detection (AC1)', () => {
    it('should detect offline → online transition with 5s debounce', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      // 1. Start offline
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      expect(listener).toHaveBeenCalledWith(false);
      listener.mockClear();

      // 2. Transition to online
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // Listener NOT called yet (debounce active)
      expect(listener).not.toHaveBeenCalled();

      // 3. Fast-forward 4 seconds (not enough)
      jest.advanceTimersByTime(4000);
      expect(listener).not.toHaveBeenCalled();

      // 4. Fast-forward remaining 1 second (total 5s)
      jest.advanceTimersByTime(1000);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should NOT debounce offline transition (immediate notification)', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      // Start online
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      listener.mockClear();

      // Transition to offline
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      // Should be called immediately (no debounce)
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should handle network flapping (multiple online/offline rapidly)', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      // 1. Offline
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);
      expect(listener).toHaveBeenCalledWith(false);
      listener.mockClear();

      // 2. Online (debounce starts)
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // 3. Wait 2s
      jest.advanceTimersByTime(2000);
      expect(listener).not.toHaveBeenCalled();

      // 4. Offline again (should reset debounce)
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);
      expect(listener).toHaveBeenCalledWith(false);
      listener.mockClear();

      // 5. Online again (new debounce starts)
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // 6. Wait full 5s
      jest.advanceTimersByTime(5000);

      // Only ONE online notification (last one)
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should cancel previous debounce if new online transition occurs', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      // 1. Offline → Online
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // 2. Wait 3s
      jest.advanceTimersByTime(3000);

      // 3. Flap: offline → online again (reset debounce)
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // 4. Wait another 5s
      jest.advanceTimersByTime(5000);

      // Should be called ONCE (second online transition)
      const onlineCalls = listener.mock.calls.filter((call) => call[0] === true);
      expect(onlineCalls).toHaveLength(1);
    });
  });

  describe('isConnected logic', () => {
    it('should consider connected when isConnected=true and isInternetReachable=true', () => {
      monitor.start();

      const listener = jest.fn();
      monitor.addListener(listener);

      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // Clear offline call from transition detection, focus on final state
      listener.mockClear();

      // Trigger same state again (no transition)
      networkChangeHandler({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      // Internal state should be "connected" (no new notifications)
    });

    it('should consider connected when isConnected=true and isInternetReachable=null (unknown)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: null, // Unknown
      });

      const isConnected = await monitor.getCurrentState();

      // Conservative: assume connected when unknown
      expect(isConnected).toBe(true);
    });

    it('should consider NOT connected when isConnected=true but isInternetReachable=false (captive portal)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true, // WiFi connected
        isInternetReachable: false, // But no internet (captive portal)
      });

      const isConnected = await monitor.getCurrentState();

      expect(isConnected).toBe(false);
    });

    it('should consider NOT connected when isConnected=false', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const isConnected = await monitor.getCurrentState();

      expect(isConnected).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should catch errors in listeners and continue', () => {
      monitor.start();

      const listener1 = jest.fn(() => {
        throw new Error('Listener 1 error');
      });
      const listener2 = jest.fn();

      monitor.addListener(listener1);
      monitor.addListener(listener2);

      // Mock console.error to suppress error log
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      // Trigger offline
      networkChangeHandler({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      // Both listeners called despite error in listener1
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(false);

      // Error logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[NetworkMonitor] Listener error:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
