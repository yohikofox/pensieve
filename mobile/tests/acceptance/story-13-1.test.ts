/**
 * BDD Acceptance Tests — Story 13.1: Migrer le Container DI vers Transient First (ADR-021)
 *
 * Valide les comportements de cycle de vie du container DI :
 * - AC1 : Repositories stateless → Transient (nouvelle instance par résolution)
 * - AC2 : Services stateless → Transient (nouvelle instance par résolution)
 * - AC3 : Singletons justifiés conservés (même instance partagée)
 * - AC5 : Résolution lazy dans les hooks fonctionne correctement
 *
 * Run: npm run test:acceptance
 */

import 'reflect-metadata';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { container as tsyringeContainer, injectable, inject } from 'tsyringe';

const feature = loadFeature('tests/acceptance/features/story-13-1-di-lifecycle.feature');

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTransientService() {
  @injectable()
  class TransientService {
    readonly instanceId = Math.random();
  }
  return TransientService;
}

function makeSingletonService() {
  @injectable()
  class SingletonService {
    readonly instanceId = Math.random();
  }
  return SingletonService;
}

// ── Tests ────────────────────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  let testContainer: typeof tsyringeContainer;

  beforeEach(() => {
    testContainer = tsyringeContainer.createChildContainer();
  });

  afterEach(() => {
    testContainer.clearInstances();
  });

  // ── AC1: Repository Transient ─────────────────────────────────────────────

  test('Un repository stateless retourne une nouvelle instance à chaque résolution', ({
    given,
    when,
    then,
  }) => {
    const MockRepo = makeTransientService();
    let instanceA: InstanceType<typeof MockRepo>;
    let instanceB: InstanceType<typeof MockRepo>;

    given('le container DI est initialisé avec un repository Transient', () => {
      testContainer.register(MockRepo, { useClass: MockRepo });
    });

    when('je résous le repository deux fois successivement', () => {
      instanceA = testContainer.resolve(MockRepo);
      instanceB = testContainer.resolve(MockRepo);
    });

    then("j'obtiens deux instances distinctes du repository", () => {
      expect(instanceA).not.toBe(instanceB);
      expect(instanceA.instanceId).not.toBe(instanceB.instanceId);
    });
  });

  // ── AC2: Service Transient ────────────────────────────────────────────────

  test('Un service stateless retourne une nouvelle instance à chaque résolution', ({
    given,
    when,
    then,
  }) => {
    const MockService = makeTransientService();
    let instanceA: InstanceType<typeof MockService>;
    let instanceB: InstanceType<typeof MockService>;

    given('le container DI est initialisé avec un service Transient', () => {
      testContainer.register(MockService, { useClass: MockService });
    });

    when('je résous le service deux fois successivement', () => {
      instanceA = testContainer.resolve(MockService);
      instanceB = testContainer.resolve(MockService);
    });

    then("j'obtiens deux instances distinctes du service", () => {
      expect(instanceA).not.toBe(instanceB);
      expect(instanceA.instanceId).not.toBe(instanceB.instanceId);
    });
  });

  // ── AC3: Singleton conservé ───────────────────────────────────────────────

  test('Un service avec état conserve la même instance via le cycle de vie Singleton', ({
    given,
    when,
    then,
  }) => {
    const MockStatefulService = makeSingletonService();
    let instanceA: InstanceType<typeof MockStatefulService>;
    let instanceB: InstanceType<typeof MockStatefulService>;

    given('le container DI est initialisé avec un service Singleton justifié', () => {
      testContainer.registerSingleton(MockStatefulService, MockStatefulService);
    });

    when('je résous le service deux fois successivement', () => {
      instanceA = testContainer.resolve(MockStatefulService);
      instanceB = testContainer.resolve(MockStatefulService);
    });

    then("j'obtiens la même instance du service", () => {
      expect(instanceA).toBe(instanceB);
      expect(instanceA.instanceId).toBe(instanceB.instanceId);
    });
  });

  // ── AC3: Transient + Singleton dependency ─────────────────────────────────

  test('Un service Transient avec une dépendance Singleton partage bien la dépendance', ({
    given,
    and,
    when,
    then,
    but,
  }) => {
    const SHARED_DEP_TOKEN = Symbol('ISharedDependency');

    @injectable()
    class SharedDependency {
      readonly instanceId = Math.random();
    }

    @injectable()
    class ServiceWithSharedDep {
      constructor(
        @inject(SHARED_DEP_TOKEN) public readonly sharedDep: SharedDependency,
      ) {}
    }

    let serviceA: ServiceWithSharedDep;
    let serviceB: ServiceWithSharedDep;

    given('le container DI est initialisé avec un Singleton comme dépendance partagée', () => {
      testContainer.registerSingleton(SHARED_DEP_TOKEN, SharedDependency);
    });

    and('un service Transient qui dépend de ce Singleton', () => {
      testContainer.register(ServiceWithSharedDep, { useClass: ServiceWithSharedDep });
    });

    when('je résous le service Transient deux fois successivement', () => {
      serviceA = testContainer.resolve(ServiceWithSharedDep);
      serviceB = testContainer.resolve(ServiceWithSharedDep);
    });

    then('les deux instances du service sont différentes', () => {
      expect(serviceA).not.toBe(serviceB);
    });

    but('leurs dépendances Singleton sont identiques', () => {
      expect(serviceA.sharedDep).toBe(serviceB.sharedDep);
      expect(serviceA.sharedDep.instanceId).toBe(serviceB.sharedDep.instanceId);
    });
  });

  // ── AC5: Lazy resolution ──────────────────────────────────────────────────

  test('La résolution lazy dans les hooks React retourne correctement les services', ({
    given,
    when,
    and,
    then,
  }) => {
    const MockService = makeTransientService();
    let resolveService: () => InstanceType<typeof MockService>;
    let instanceA: InstanceType<typeof MockService>;
    let instanceB: InstanceType<typeof MockService>;

    given('le container DI est initialisé avec un service Transient', () => {
      testContainer.register(MockService, { useClass: MockService });
    });

    when('je résous le service via une fonction de résolution lazy', () => {
      resolveService = () => testContainer.resolve(MockService);
    });

    and("j'appelle la fonction de résolution lazy deux fois", () => {
      instanceA = resolveService();
      instanceB = resolveService();
    });

    then('chaque appel retourne une nouvelle instance du service Transient', () => {
      expect(instanceA).not.toBe(instanceB);
      expect(instanceA.instanceId).not.toBe(instanceB.instanceId);
    });
  });
});
