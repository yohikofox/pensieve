import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { injectable } from 'tsyringe';

/**
 * NetworkMonitor Service
 *
 * Détecte les changements de connectivité réseau et notifie les listeners.
 * Utilise @react-native-community/netinfo pour la détection native.
 *
 * Features:
 * - Détection online/offline en temps réel
 * - Debounce automatique pour éviter les triggers multiples (network flapping)
 * - Listeners callback pour réagir aux changements
 *
 * Usage:
 * ```typescript
 * const monitor = container.resolve(NetworkMonitor);
 * monitor.addListener((isConnected) => {
 *   if (isConnected) {
 *     syncService.sync();
 *   }
 * });
 * monitor.start();
 * ```
 */
@injectable()
export class NetworkMonitor {
  private unsubscribe: NetInfoSubscription | null = null;
  private listeners: Set<(isConnected: boolean) => void> = new Set();
  private syncTimeout: NodeJS.Timeout | null = null;
  private lastConnectedState: boolean | null = null;
  private debounceDelayMs: number;

  /**
   * @param debounceDelayMs - Délai de debounce en ms (défaut: 5000ms = 5s selon AC1)
   */
  constructor(debounceDelayMs: number = 5000) {
    this.debounceDelayMs = debounceDelayMs;
  }

  /**
   * Démarre la surveillance réseau.
   * S'abonne aux changements de connectivité via NetInfo.
   */
  public start(): void {
    if (this.unsubscribe) {
      console.warn('NetworkMonitor already started');
      return;
    }

    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
  }

  /**
   * Arrête la surveillance réseau.
   * Nettoie les listeners et les timeouts.
   */
  public stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.listeners.clear();
    this.lastConnectedState = null;
  }

  /**
   * Ajoute un listener qui sera appelé lors des changements de connectivité.
   *
   * @param listener - Callback appelé avec `isConnected` (true = online, false = offline)
   * @returns Fonction de cleanup pour retirer le listener
   */
  public addListener(
    listener: (isConnected: boolean) => void,
  ): () => void {
    this.listeners.add(listener);

    // Return cleanup function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Récupère l'état actuel du réseau (one-shot, pas de subscription).
   *
   * @returns Promise resolving to `isConnected` boolean
   */
  public async getCurrentState(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return this.isConnected(state);
  }

  /**
   * Handler interne appelé par NetInfo lors d'un changement réseau.
   *
   * Implémente le debounce pour éviter les triggers multiples.
   * Détecte spécifiquement la transition offline → online pour trigger auto-sync (AC1).
   *
   * @param state - État réseau fourni par NetInfo
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    const isConnected = this.isConnected(state);

    // Débug log
    console.log(
      `[NetworkMonitor] Network change: ${isConnected ? 'ONLINE' : 'OFFLINE'}`,
    );

    // Détection transition offline → online (AC1)
    const wasOffline = this.lastConnectedState === false;
    const isNowOnline = isConnected === true;

    this.lastConnectedState = isConnected;

    // Si transition offline → online, déclencher sync avec debounce
    if (wasOffline && isNowOnline) {
      console.log(
        `[NetworkMonitor] Transition offline → online detected, scheduling sync after ${this.debounceDelayMs}ms debounce`,
      );

      // Clear timeout précédent si existe (avoid network flapping)
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }

      // Debounce: attendre debounceDelayMs avant de notifier listeners
      this.syncTimeout = setTimeout(() => {
        console.log('[NetworkMonitor] Debounce completed, notifying listeners');
        this.notifyListeners(true);
        this.syncTimeout = null;
      }, this.debounceDelayMs);
    } else {
      // Pour offline, notifier immédiatement (pas de debounce nécessaire)
      if (!isConnected) {
        this.notifyListeners(false);
      }
    }
  };

  /**
   * Notifie tous les listeners du changement de connectivité.
   *
   * ADR-023: Pas de try/catch - les listeners doivent gérer leurs propres erreurs.
   * Si un listener throw, l'erreur propagera et révèlera le problème.
   *
   * @param isConnected - true = online, false = offline
   */
  private notifyListeners(isConnected: boolean): void {
    for (const listener of this.listeners) {
      listener(isConnected);
    }
  }

  /**
   * Détermine si l'état réseau représente une connexion active.
   *
   * Considère comme "connecté" si:
   * - isConnected = true
   * - isInternetReachable = true OU null (null = unknown, on suppose connecté)
   *
   * @param state - État réseau de NetInfo
   * @returns true si connecté, false sinon
   */
  private isConnected(state: NetInfoState): boolean {
    // isConnected = false → définitivement offline
    if (!state.isConnected) {
      return false;
    }

    // isConnected = true, mais isInternetReachable peut être:
    // - true: Internet confirmé accessible
    // - false: Internet pas accessible (wifi captive portal, etc.)
    // - null: Statut inconnu (on suppose accessible pour éviter faux négatifs)

    // Conservative approach: si isConnected = true et isInternetReachable !== false, on suppose online
    return state.isInternetReachable !== false;
  }
}
