/**
 * Result Pattern — Unit Tests (ADR-023)
 *
 * Validates all 8 result types and their helper functions.
 * Story 13.4 — Généraliser le Result Pattern
 */

import {
  RepositoryResultType,
  success,
  notFound,
  databaseError,
  validationError,
  networkError,
  authError,
  businessError,
  unknownError,
} from "../Result";

describe("Result Pattern — shared/domain/Result", () => {
  describe("success()", () => {
    it("retourne SUCCESS avec les données fournies", () => {
      const result = success("hello");
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBe("hello");
      expect(result.error).toBeUndefined();
    });

    it("retourne SUCCESS avec undefined pour Result<void>", () => {
      const result = success(undefined);
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeUndefined();
    });
  });

  describe("notFound()", () => {
    it("retourne NOT_FOUND avec le message fourni", () => {
      const result = notFound("Ressource introuvable");
      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
      expect(result.error).toBe("Ressource introuvable");
      expect(result.data).toBeUndefined();
    });

    it("retourne NOT_FOUND avec le message par défaut si aucun message fourni", () => {
      const result = notFound();
      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
      expect(result.error).toBe("Resource not found");
    });
  });

  describe("databaseError()", () => {
    it("retourne DATABASE_ERROR avec le message d'erreur", () => {
      const result = databaseError("Erreur SQLite: contrainte unique violée");
      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toBe("Erreur SQLite: contrainte unique violée");
      expect(result.data).toBeUndefined();
    });
  });

  describe("validationError()", () => {
    it("retourne VALIDATION_ERROR avec le message d'erreur", () => {
      const result = validationError("Le chemin audio est invalide");
      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe("Le chemin audio est invalide");
      expect(result.data).toBeUndefined();
    });
  });

  describe("networkError()", () => {
    it("retourne NETWORK_ERROR avec le message d'erreur", () => {
      const result = networkError("Connexion refusée");
      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
      expect(result.error).toBe("Connexion refusée");
      expect(result.data).toBeUndefined();
    });
  });

  describe("authError()", () => {
    it("retourne AUTH_ERROR avec le message d'erreur", () => {
      const result = authError("Token JWT expiré");
      expect(result.type).toBe(RepositoryResultType.AUTH_ERROR);
      expect(result.error).toBe("Token JWT expiré");
      expect(result.data).toBeUndefined();
    });
  });

  describe("businessError()", () => {
    it("retourne BUSINESS_ERROR avec le message d'erreur", () => {
      const result = businessError("Fichier audio introuvable: /tmp/test.m4a");
      expect(result.type).toBe(RepositoryResultType.BUSINESS_ERROR);
      expect(result.error).toBe("Fichier audio introuvable: /tmp/test.m4a");
      expect(result.data).toBeUndefined();
    });
  });

  describe("unknownError()", () => {
    it("retourne UNKNOWN_ERROR avec le message d'erreur", () => {
      const result = unknownError("Erreur inattendue lors de la conversion audio");
      expect(result.type).toBe(RepositoryResultType.UNKNOWN_ERROR);
      expect(result.error).toBe("Erreur inattendue lors de la conversion audio");
      expect(result.data).toBeUndefined();
    });
  });

  describe("Enum RepositoryResultType", () => {
    it("contient les 8 types attendus", () => {
      expect(RepositoryResultType.SUCCESS).toBe("success");
      expect(RepositoryResultType.NOT_FOUND).toBe("not_found");
      expect(RepositoryResultType.DATABASE_ERROR).toBe("database_error");
      expect(RepositoryResultType.VALIDATION_ERROR).toBe("validation_error");
      expect(RepositoryResultType.NETWORK_ERROR).toBe("network_error");
      expect(RepositoryResultType.AUTH_ERROR).toBe("auth_error");
      expect(RepositoryResultType.BUSINESS_ERROR).toBe("business_error");
      expect(RepositoryResultType.UNKNOWN_ERROR).toBe("unknown_error");
    });
  });

  describe("Généricité du type RepositoryResult<T>", () => {
    it("fonctionne avec un type complexe", () => {
      const result = success({ id: "123", name: "test" });
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.id).toBe("123");
      expect(result.data?.name).toBe("test");
    });

    it("fonctionne avec un tableau", () => {
      const result = success([1, 2, 3]);
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toHaveLength(3);
    });
  });
});
