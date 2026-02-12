/**
 * Représentation d'un tier de subscription
 */
export interface ISubscriptionTier {
  /**
   * ID unique du tier
   */
  id: string;

  /**
   * Nom du tier (ex: "free", "pro", "enterprise")
   */
  name: string;

  /**
   * Prix mensuel en euros
   */
  priceMonthly: number;

  /**
   * Indique si le tier est actif
   */
  isActive: boolean;

  /**
   * Date de création
   */
  createdAt: Date;

  /**
   * Date de dernière modification
   */
  updatedAt: Date;
}

/**
 * Représentation d'une subscription utilisateur
 */
export interface IUserSubscription {
  /**
   * ID unique de la subscription
   */
  id: string;

  /**
   * ID de l'utilisateur
   */
  userId: string;

  /**
   * ID du tier
   */
  tierId: string;

  /**
   * Statut de la subscription
   */
  status: SubscriptionStatus;

  /**
   * Date d'expiration de la subscription (null si illimitée)
   */
  expiresAt: Date | null;

  /**
   * Date de création
   */
  createdAt: Date;

  /**
   * Date de dernière modification
   */
  updatedAt: Date;
}

/**
 * Statuts possibles d'une subscription
 */
export enum SubscriptionStatus {
  /**
   * Subscription active
   */
  ACTIVE = 'active',

  /**
   * Subscription expirée
   */
  EXPIRED = 'expired',

  /**
   * Subscription annulée
   */
  CANCELLED = 'cancelled',

  /**
   * Subscription en attente de paiement
   */
  PENDING = 'pending',
}
