/**
 * DEV TEST — Comparaison `create` (singleton) vs `createStore` + Context (scopé)
 *
 * Protocole :
 * 1. Incrémente les deux counters
 * 2. Appuie sur "← Retour" (unmount)
 * 3. Reviens sur cet écran
 *
 * Résultat attendu :
 * - Colonne ROUGE  (`create`)   : counter conservé, montages ≥ 2
 * - Colonne VERTE  (Context)    : counter = 0, montages = 1
 *
 * Note : ContextStoreChild lit le store via le hook useContextTestStore
 * sans avoir accès à l'instance — le Context fait le lien avec le parent.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useZustandPersistenceTestStore,
  createContextTestStore,
  ContextTestStoreContext,
  useContextTestStore,
  type ContextTestStoreApi,
} from '../../stores/__dev__/zustandPersistenceTestStore';

// ─── Enfant qui lit le Context store ─────────────────────────────────────────
// N'importe pas l'instance — accède au store via useContextTestStore uniquement

const ContextStoreChild: React.FC = () => {
  const counter = useContextTestStore((s) => s.counter);
  const increment = useContextTestStore((s) => s.increment);

  return (
    <View style={{ marginTop: 12, padding: 12, backgroundColor: '#dcfce7', borderRadius: 8 }}>
      <Text style={{ fontSize: 11, color: '#166534', marginBottom: 6, fontWeight: '600' }}>
        ENFANT — accède au store via useContextTestStore (sans connaître l'instance)
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: '#16a34a' }}>{counter}</Text>
        <TouchableOpacity
          onPress={increment}
          style={{ backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>+ Incrémenter depuis l'enfant</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ZustandPersistenceTestScreen: React.FC = () => {
  const navigation = useNavigation();

  // Pattern B : instance créée UNE fois au mount de ce composant
  // Détruite automatiquement au unmount → plus de stale state
  const [contextStore] = useState<ContextTestStoreApi>(createContextTestStore);

  // Pattern A — singleton
  const sCounter  = useZustandPersistenceTestStore((s) => s.counter);
  const sMounts   = useZustandPersistenceTestStore((s) => s.mountCount);
  const sEvents   = useZustandPersistenceTestStore((s) => s.events);
  const sIncrement = useZustandPersistenceTestStore((s) => s.increment);
  const sRecord   = useZustandPersistenceTestStore((s) => s.recordEvent);

  // Pattern A — enregistre le mount dans le singleton
  useEffect(() => {
    const ts = new Date().toLocaleTimeString();
    sRecord(`counter=${useZustandPersistenceTestStore.getState().counter} à ${ts}`);
    return () => { console.log('[Test] singleton screen unmount'); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pattern B — enregistre le mount dans le context store
  useEffect(() => {
    const ts = new Date().toLocaleTimeString();
    const state = contextStore.getState();
    state.recordEvent(`counter=${state.counter} à ${ts}`);
    return () => { console.log('[Test] context store destroyed avec le composant'); };
  }, [contextStore]);

  // Lit les valeurs du context store pour l'affichage dans le parent
  // (les enfants utilisent useContextTestStore — voir ContextStoreChild)
  const cState = contextStore.getState();
  const [cCounter, setCCounter] = useState(cState.counter);
  const [cMounts, setCMounts] = useState(cState.mountCount);
  const [cEvents, setCEvents] = useState(cState.events);

  useEffect(() => {
    return contextStore.subscribe((s) => {
      setCCounter(s.counter);
      setCMounts(s.mountCount);
      setCEvents(s.events);
    });
  }, [contextStore]);

  return (
    <ContextTestStoreContext.Provider value={contextStore}>
      <ScrollView style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
        <View style={{ padding: 16, gap: 16 }}>

          {/* Légende */}
          <View style={{ backgroundColor: '#fef9c3', borderRadius: 8, padding: 14 }}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: '#92400e', marginBottom: 4 }}>
              Protocole
            </Text>
            <Text style={{ fontSize: 12, color: '#78350f', lineHeight: 18 }}>
              1. Incrémente les deux counters{'\n'}
              2. Appuie sur "← Retour" (unmount){'\n'}
              3. Reviens sur cet écran{'\n\n'}
              🔴 Singleton  → counter conservé, montages ≥ 2{'\n'}
              🟢 Context    → counter = 0, montages = 1
            </Text>
          </View>

          {/* Deux colonnes */}
          <View style={{ flexDirection: 'row', gap: 12 }}>

            {/* Colonne A — create (singleton) */}
            <View style={{
              flex: 1,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor: sMounts > 1 ? '#ef4444' : '#e5e7eb',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginBottom: 8 }}>
                create(){'\n'}SINGLETON
              </Text>
              <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Counter</Text>
              <Text style={{ fontSize: 48, fontWeight: '700', color: '#dc2626' }}>{sCounter}</Text>
              <TouchableOpacity
                onPress={sIncrement}
                style={{ marginTop: 8, backgroundColor: '#dc2626', padding: 10, borderRadius: 6, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+1</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 12, marginBottom: 2 }}>Montages</Text>
              <Text style={{ fontSize: 32, fontWeight: '700', color: sMounts > 1 ? '#dc2626' : '#6b7280' }}>
                {sMounts}
              </Text>
              {sMounts > 1 && (
                <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: '600' }}>
                  ⚠️ State persisté
                </Text>
              )}
            </View>

            {/* Colonne B — createStore + Context */}
            <View style={{
              flex: 1,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor: cMounts <= 1 ? '#22c55e' : '#e5e7eb',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a', marginBottom: 8 }}>
                createStore{'\n'}+ CONTEXT
              </Text>
              <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Counter</Text>
              <Text style={{ fontSize: 48, fontWeight: '700', color: '#16a34a' }}>{cCounter}</Text>
              <TouchableOpacity
                onPress={() => contextStore.getState().increment()}
                style={{ marginTop: 8, backgroundColor: '#16a34a', padding: 10, borderRadius: 6, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+1</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 12, marginBottom: 2 }}>Montages</Text>
              <Text style={{ fontSize: 32, fontWeight: '700', color: cMounts <= 1 ? '#16a34a' : '#6b7280' }}>
                {cMounts}
              </Text>
              {cMounts <= 1 && cMounts > 0 && (
                <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: '600' }}>
                  ✓ Instance fraîche
                </Text>
              )}
            </View>
          </View>

          {/* Enfant du Context store */}
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#86efac' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 4 }}>
              Comment l'enfant accède au Context store
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              ContextStoreChild utilise useContextTestStore() — il ne connaît pas l'instance
            </Text>
            <ContextStoreChild />
          </View>

          {/* Journal des deux stores */}
          <View style={{ backgroundColor: '#1e1e2e', borderRadius: 12, padding: 14 }}>
            <Text style={{ color: '#a6adc8', fontSize: 11, fontWeight: '700', marginBottom: 10 }}>
              JOURNAL — SINGLETON (🔴)
            </Text>
            {sEvents.length === 0
              ? <Text style={{ color: '#585b70', fontSize: 12 }}>Aucun événement</Text>
              : sEvents.map((e, i) => (
                  <Text key={i} style={{ color: '#f38ba8', fontSize: 11, marginBottom: 3 }}>{e}</Text>
                ))
            }
            <Text style={{ color: '#a6adc8', fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 10 }}>
              JOURNAL — CONTEXT (🟢)
            </Text>
            {cEvents.length === 0
              ? <Text style={{ color: '#585b70', fontSize: 12 }}>Aucun événement</Text>
              : cEvents.map((e, i) => (
                  <Text key={i} style={{ color: '#a6e3a1', fontSize: 11, marginBottom: 3 }}>{e}</Text>
                ))
            }
          </View>

          {/* Retour */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ backgroundColor: '#374151', padding: 16, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              ← Retour (unmount)
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </ContextTestStoreContext.Provider>
  );
};
