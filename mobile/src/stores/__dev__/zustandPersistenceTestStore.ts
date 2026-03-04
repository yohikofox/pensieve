/**
 * DEV TEST — Deux patterns Zustand côte à côte
 *
 * Pattern A : `create`       → singleton module-level, state persiste entre mounts
 * Pattern B : `createStore`  → instance scopée au lifecycle du composant parent,
 *                              les enfants y accèdent via Context sans connaître l'instance
 */

import { create, useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createContext, useContext } from 'react';

// ─── State partagé par les deux patterns ─────────────────────────────────────

export interface TestStoreState {
  counter: number;
  mountCount: number;
  events: string[];
  increment: () => void;
  recordEvent: (msg: string) => void;
}

const buildActions = (set: (fn: (s: TestStoreState) => Partial<TestStoreState>) => void) => ({
  counter: 0,
  mountCount: 0,
  events: [] as string[],
  increment: () => set((s) => ({ counter: s.counter + 1 })),
  recordEvent: (msg: string) =>
    set((s) => ({
      mountCount: s.mountCount + 1,
      events: [`[Mount #${s.mountCount + 1}] ${msg}`, ...s.events].slice(0, 20),
    })),
});

// ─── Pattern A : singleton `create` ──────────────────────────────────────────
// Une seule instance pour toute l'app. State survit aux unmounts.

export const useZustandPersistenceTestStore = create<TestStoreState>((set) =>
  buildActions(set)
);

// ─── Pattern B : `createStore` + Context ─────────────────────────────────────
// Factory exportée → le parent l'importe et crée l'instance dans useState()
// L'instance naît au mount du parent et meurt à son unmount.

export const createContextTestStore = () =>
  createStore<TestStoreState>()((set) => buildActions(set));

export type ContextTestStoreApi = ReturnType<typeof createContextTestStore>;

export const ContextTestStoreContext = createContext<ContextTestStoreApi | null>(null);

// Hook public pour les enfants — ils n'importent que ce hook, jamais l'instance
export function useContextTestStore<T>(selector: (s: TestStoreState) => T): T {
  const store = useContext(ContextTestStoreContext);
  if (!store) throw new Error('Missing ContextTestStoreContext.Provider');
  return useStore(store, selector);
}
