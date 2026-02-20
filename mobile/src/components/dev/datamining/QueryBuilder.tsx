/**
 * Query Builder — Constructeur graphique de requêtes SQL
 *
 * Composant accordéon avec 8 sections, optimisé pour le tactile (cibles ≥ 44pt) :
 * 1. Table source       → liste verticale plein-écran
 * 2. Colonnes SELECT    → chips larges + agrégats en carte verticale
 * 3. JOINs
 * 4. WHERE
 * 5. GROUP BY
 * 6. HAVING
 * 7. ORDER BY
 * 8. LIMIT
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { database } from '../../../database';
import type {
  QueryAst,
  AggregateColumn,
  JoinClause,
  WhereCondition,
  OrderByClause,
  AggregateFunction,
  JoinType,
  ComparisonOperator,
  OrderDirection,
  LogicOperator,
} from './QueryAst';
import { queryAstToSql } from './queryAstToSql';

// ─── Section accordéon ───────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string; // texte court affiché dans le header quand fermé
  // Mode contrôlé (optionnel) : si fournis, l'état est géré depuis l'extérieur
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Section: React.FC<SectionProps> = ({
  title, children, defaultOpen = false, badge,
  open: controlledOpen, onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setInternalOpen((v) => !v);
    }
  };

  return (
    <View className="mb-3 border border-border-default rounded-xl overflow-hidden">
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-4 bg-bg-secondary"
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text className="text-base font-semibold text-text-primary flex-1">{title}</Text>
        {badge ? (
          <Text className="text-sm text-primary-500 mr-2" numberOfLines={1}>{badge}</Text>
        ) : null}
        <Text className="text-text-tertiary text-base">{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && <View className="p-4">{children}</View>}
    </View>
  );
};

// ─── Bouton "Ajouter" standardisé ────────────────────────────────────────────

interface AddButtonProps {
  label: string;
  onPress: () => void;
}

const AddButton: React.FC<AddButtonProps> = ({ label, onPress }) => (
  <TouchableOpacity
    className="flex-row items-center justify-center border border-primary-500 rounded-lg py-3 px-4 mb-3"
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text className="text-sm font-semibold text-primary-500">{label}</Text>
  </TouchableOpacity>
);

// ─── Bouton "Supprimer" standardisé ──────────────────────────────────────────

interface DeleteButtonProps {
  onPress: () => void;
  label?: string;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({ onPress, label = 'Supprimer' }) => (
  <TouchableOpacity
    className="py-2.5 px-3 rounded-lg border border-status-error items-center"
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text className="text-sm text-status-error font-medium">{label}</Text>
  </TouchableOpacity>
);

// ─── Groupe de boutons toggle (radio / multiselect) ──────────────────────────

interface ToggleGroupProps<T extends string> {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}

function ToggleGroup<T extends string>({ options, value, onChange, wrap }: ToggleGroupProps<T>) {
  return (
    <View className={`${wrap ? 'flex-row flex-wrap gap-2' : 'flex-row gap-2'}`}>
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            className={`px-3 py-2.5 rounded-lg border ${isActive ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Chips multiselect (colonnes) ────────────────────────────────────────────

interface ChipSelectProps {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

const ChipSelect: React.FC<ChipSelectProps> = ({ options, selected, onToggle }) => (
  <View className="flex-row flex-wrap gap-2">
    {options.map((opt) => {
      const isSelected = selected.includes(opt);
      return (
        <TouchableOpacity
          key={opt}
          className={`px-3 py-2.5 rounded-lg border ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
          onPress={() => onToggle(opt)}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${isSelected ? 'text-white font-semibold' : 'text-text-secondary'}`}>
            {isSelected ? '✓ ' : ''}{opt}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Input standardisé ───────────────────────────────────────────────────────

interface FieldInputProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  label?: string;
}

const FieldInput: React.FC<FieldInputProps> = ({ value, onChangeText, placeholder, label }) => (
  <View className="mb-2">
    {label ? <Text className="text-xs text-text-tertiary mb-1">{label}</Text> : null}
    <TextInput
      className="border border-border-default rounded-lg px-3 py-3 text-sm text-text-primary bg-bg-input"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      autoCapitalize="none"
      autoCorrect={false}
    />
  </View>
);

// ─── Main component ──────────────────────────────────────────────────────────

interface QueryBuilderProps {
  initialAst: QueryAst;
  onChange: (ast: QueryAst) => void;
  onSqlChange: (sql: string) => void;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ initialAst, onChange, onSqlChange }) => {
  const { height: windowHeight } = useWindowDimensions();
  const [ast, setAst] = useState<QueryAst>(initialAst);
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  // La section table est contrôlée manuellement pour se fermer après sélection
  const [tableSectionOpen, setTableSectionOpen] = useState(true);

  useEffect(() => {
    try {
      const r = database.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      ) as { rows?: { name: string }[] };
      setTables((r.rows || []).map((row) => row.name));
    } catch {
      setTables([]);
    }
  }, []);

  useEffect(() => {
    if (!ast.from) { setColumns([]); return; }
    try {
      const r = database.execute(
        `PRAGMA table_info("${ast.from.replace(/"/g, '""')}")`
      ) as { rows?: { name: string }[] };
      setColumns((r.rows || []).map((row) => row.name));
    } catch {
      setColumns([]);
    }
  }, [ast.from]);

  const updateAst = useCallback((partial: Partial<QueryAst>) => {
    setAst((prev) => {
      const next = { ...prev, ...partial };
      onChange(next);
      onSqlChange(queryAstToSql(next));
      return next;
    });
  }, [onChange, onSqlChange]);

  useEffect(() => { onSqlChange(queryAstToSql(ast)); }, [ast, onSqlChange]);

  // ─── Section 1 : Table source (liste verticale, hauteur max 50% écran) ─
  const renderTableSection = () => (
    <Section
      title="📋 Table source"
      badge={ast.from || undefined}
      open={tableSectionOpen}
      onOpenChange={setTableSectionOpen}
    >
      {tables.length === 0 ? (
        <Text className="text-sm text-text-tertiary italic py-2">Chargement des tables...</Text>
      ) : (
        <View
          className="border border-border-subtle rounded-lg overflow-hidden"
          style={{ height: windowHeight * 0.3 }}
        >
          <ScrollView
            showsVerticalScrollIndicator
            nestedScrollEnabled
            style={{ flex: 1 }}
          >
            {tables.map((table, index) => {
              const isSelected = ast.from === table;
              return (
                <TouchableOpacity
                  key={table}
                  className={`flex-row items-center px-4 py-4 ${isSelected ? 'bg-primary-50' : 'bg-bg-primary'} ${index > 0 ? 'border-t border-border-subtle' : ''}`}
                  onPress={() => {
                    updateAst({ from: table, select: [], groupBy: [], orderBy: [] });
                    setTableSectionOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text className={`flex-1 text-base ${isSelected ? 'text-primary-600 font-semibold' : 'text-text-primary'}`}>
                    {table}
                  </Text>
                  {isSelected && (
                    <Text className="text-primary-500 text-lg font-bold">✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </Section>
  );

  // ─── Section 2 : Colonnes SELECT + agrégats ─────────────────────────────
  const renderSelectSection = () => {
    const aggregateFns: AggregateFunction[] = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

    const addAggregate = () => {
      updateAst({
        aggregates: [...ast.aggregates, {
          fn: 'COUNT', col: '*', alias: `count_${ast.aggregates.length + 1}`,
        }],
      });
    };

    const updateAggregate = (index: number, partial: Partial<AggregateColumn>) => {
      updateAst({ aggregates: ast.aggregates.map((a, i) => i === index ? { ...a, ...partial } : a) });
    };

    const removeAggregate = (index: number) => {
      updateAst({ aggregates: ast.aggregates.filter((_, i) => i !== index) });
    };

    const selectedCount = ast.select.length + ast.aggregates.length;

    return (
      <Section
        title="📌 Colonnes SELECT"
        badge={selectedCount > 0 ? `${selectedCount} sélectionnée(s)` : undefined}
      >
        {columns.length > 0 ? (
          <>
            <Text className="text-sm text-text-tertiary mb-2">Colonnes :</Text>
            <ChipSelect
              options={columns}
              selected={ast.select}
              onToggle={(col) => {
                const next = ast.select.includes(col)
                  ? ast.select.filter((c) => c !== col)
                  : [...ast.select, col];
                updateAst({ select: next });
              }}
            />
          </>
        ) : (
          <Text className="text-sm text-text-tertiary italic mb-2">Sélectionnez une table d'abord</Text>
        )}

        <View className="mt-4">
          <Text className="text-sm text-text-tertiary mb-2">Agrégats :</Text>
          {ast.aggregates.map((agg, index) => (
            <View key={index} className="mb-3 border border-border-subtle rounded-xl p-3">
              {/* Ligne 1 : sélecteur de fonction */}
              <Text className="text-xs text-text-tertiary mb-1.5">Fonction</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                <View className="flex-row gap-2">
                  {aggregateFns.map((fn) => (
                    <TouchableOpacity
                      key={fn}
                      className={`px-3 py-2.5 rounded-lg border ${agg.fn === fn ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
                      onPress={() => updateAggregate(index, { fn })}
                    >
                      <Text className={`text-sm font-medium ${agg.fn === fn ? 'text-white' : 'text-text-secondary'}`}>
                        {fn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {/* Ligne 2 : colonne + alias */}
              <FieldInput
                label="Colonne (ou *)"
                value={agg.col}
                onChangeText={(v) => updateAggregate(index, { col: v })}
                placeholder="*"
              />
              <FieldInput
                label="Alias"
                value={agg.alias}
                onChangeText={(v) => updateAggregate(index, { alias: v })}
                placeholder="total"
              />
              <DeleteButton onPress={() => removeAggregate(index)} />
            </View>
          ))}
          <AddButton label="+ Ajouter un agrégat" onPress={addAggregate} />
        </View>
      </Section>
    );
  };

  // ─── Section 3 : JOINs ──────────────────────────────────────────────────
  const renderJoinsSection = () => {
    const joinTypes: JoinType[] = ['LEFT', 'INNER'];

    const addJoin = () => updateAst({ joins: [...ast.joins, { type: 'LEFT', table: '', on: '' }] });
    const updateJoin = (i: number, p: Partial<JoinClause>) =>
      updateAst({ joins: ast.joins.map((j, idx) => idx === i ? { ...j, ...p } : j) });
    const removeJoin = (i: number) =>
      updateAst({ joins: ast.joins.filter((_, idx) => idx !== i) });

    return (
      <Section title="🔗 JOINs" badge={ast.joins.length > 0 ? `${ast.joins.length}` : undefined}>
        {ast.joins.map((join, index) => (
          <View key={index} className="mb-3 border border-border-subtle rounded-xl p-3">
            <Text className="text-xs text-text-tertiary mb-1.5">Type de jointure</Text>
            <View className="flex-row gap-2 mb-3">
              {joinTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`flex-1 py-3 rounded-lg border items-center ${join.type === type ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
                  onPress={() => updateJoin(index, { type })}
                >
                  <Text className={`text-sm font-medium ${join.type === type ? 'text-white' : 'text-text-secondary'}`}>
                    {type} JOIN
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <FieldInput
              label="Table"
              value={join.table}
              onChangeText={(v) => updateJoin(index, { table: v })}
              placeholder="Nom de la table"
            />
            <FieldInput
              label="Condition ON"
              value={join.on}
              onChangeText={(v) => updateJoin(index, { on: v })}
              placeholder="todos.thought_id = thoughts.id"
            />
            <DeleteButton onPress={() => removeJoin(index)} />
          </View>
        ))}
        <AddButton label="+ Ajouter un JOIN" onPress={addJoin} />
      </Section>
    );
  };

  // ─── Section 4 : WHERE ──────────────────────────────────────────────────
  const renderWhereSection = () => {
    const operators: ComparisonOperator[] = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IS NULL', 'IS NOT NULL'];
    const logicOps: LogicOperator[] = ['AND', 'OR'];

    const addCondition = () =>
      updateAst({ where: [...ast.where, { col: '', op: '=', val: '', logic: 'AND' }] });
    const updateCondition = (i: number, p: Partial<WhereCondition>) =>
      updateAst({ where: ast.where.map((c, idx) => idx === i ? { ...c, ...p } : c) });
    const removeCondition = (i: number) =>
      updateAst({ where: ast.where.filter((_, idx) => idx !== i) });

    return (
      <Section title="🔍 WHERE" badge={ast.where.length > 0 ? `${ast.where.length} condition(s)` : undefined}>
        {ast.where.map((cond, index) => (
          <View key={index} className="mb-3 border border-border-subtle rounded-xl p-3">
            {/* AND / OR pour les conditions suivantes */}
            {index > 0 && (
              <View className="mb-3">
                <Text className="text-xs text-text-tertiary mb-1.5">Opérateur logique</Text>
                <ToggleGroup<LogicOperator>
                  options={logicOps}
                  value={cond.logic}
                  onChange={(v) => updateCondition(index, { logic: v })}
                />
              </View>
            )}

            <FieldInput
              label="Colonne"
              value={cond.col}
              onChangeText={(v) => updateCondition(index, { col: v })}
              placeholder="status"
            />

            <Text className="text-xs text-text-tertiary mb-1.5">Opérateur</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {operators.map((op) => (
                  <TouchableOpacity
                    key={op}
                    className={`px-3 py-2.5 rounded-lg border ${cond.op === op ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
                    onPress={() => updateCondition(index, { op })}
                  >
                    <Text className={`text-sm ${cond.op === op ? 'text-white font-medium' : 'text-text-secondary'}`}>
                      {op}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {cond.op !== 'IS NULL' && cond.op !== 'IS NOT NULL' && (
              <FieldInput
                label="Valeur"
                value={cond.val}
                onChangeText={(v) => updateCondition(index, { val: v })}
                placeholder="todo"
              />
            )}

            <DeleteButton onPress={() => removeCondition(index)} />
          </View>
        ))}
        <AddButton label="+ Ajouter une condition" onPress={addCondition} />
      </Section>
    );
  };

  // ─── Section 5 : GROUP BY ───────────────────────────────────────────────
  const renderGroupBySection = () => (
    <Section
      title="📊 GROUP BY"
      badge={ast.groupBy.length > 0 ? ast.groupBy.join(', ') : undefined}
    >
      {columns.length > 0 ? (
        <ChipSelect
          options={columns}
          selected={ast.groupBy}
          onToggle={(col) => {
            const next = ast.groupBy.includes(col)
              ? ast.groupBy.filter((c) => c !== col)
              : [...ast.groupBy, col];
            updateAst({ groupBy: next });
          }}
        />
      ) : (
        <Text className="text-sm text-text-tertiary italic">Sélectionnez une table d'abord</Text>
      )}
    </Section>
  );

  // ─── Section 6 : HAVING ─────────────────────────────────────────────────
  const renderHavingSection = () => {
    const operators: ComparisonOperator[] = ['=', '!=', '<', '>', '<=', '>='];

    return (
      <Section title="🎯 HAVING" badge={ast.having ? `${ast.having.col} ${ast.having.op} ${ast.having.val}` : undefined}>
        {ast.having ? (
          <View>
            <FieldInput
              label="Colonne agrégée"
              value={ast.having.col}
              onChangeText={(v) => updateAst({ having: { ...ast.having!, col: v } })}
              placeholder="total"
            />
            <Text className="text-xs text-text-tertiary mb-1.5">Opérateur</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {operators.map((op) => (
                  <TouchableOpacity
                    key={op}
                    className={`px-3 py-2.5 rounded-lg border ${ast.having!.op === op ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
                    onPress={() => updateAst({ having: { ...ast.having!, op } })}
                  >
                    <Text className={`text-sm ${ast.having!.op === op ? 'text-white font-medium' : 'text-text-secondary'}`}>
                      {op}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <FieldInput
              label="Valeur"
              value={ast.having.val}
              onChangeText={(v) => updateAst({ having: { ...ast.having!, val: v } })}
              placeholder="0"
            />
            <DeleteButton onPress={() => updateAst({ having: null })} />
          </View>
        ) : (
          <AddButton
            label="+ Ajouter une condition HAVING"
            onPress={() => updateAst({ having: { col: '', op: '>', val: '0' } })}
          />
        )}
      </Section>
    );
  };

  // ─── Section 7 : ORDER BY ───────────────────────────────────────────────
  const renderOrderBySection = () => {
    const directions: OrderDirection[] = ['ASC', 'DESC'];

    const addOrder = () =>
      updateAst({ orderBy: [...ast.orderBy, { col: columns[0] || '', dir: 'DESC' }] });
    const updateOrder = (i: number, p: Partial<OrderByClause>) =>
      updateAst({ orderBy: ast.orderBy.map((o, idx) => idx === i ? { ...o, ...p } : o) });
    const removeOrder = (i: number) =>
      updateAst({ orderBy: ast.orderBy.filter((_, idx) => idx !== i) });

    return (
      <Section
        title="↕ ORDER BY"
        badge={ast.orderBy.length > 0 ? ast.orderBy.map((o) => `${o.col} ${o.dir}`).join(', ') : undefined}
      >
        {ast.orderBy.map((order, index) => (
          <View key={index} className="mb-3 border border-border-subtle rounded-xl p-3">
            <FieldInput
              label="Colonne"
              value={order.col}
              onChangeText={(v) => updateOrder(index, { col: v })}
              placeholder="created_at"
            />
            <Text className="text-xs text-text-tertiary mb-1.5">Direction</Text>
            <View className="flex-row gap-2 mb-3">
              {directions.map((dir) => (
                <TouchableOpacity
                  key={dir}
                  className={`flex-1 py-3 rounded-lg border items-center ${order.dir === dir ? 'bg-primary-500 border-primary-500' : 'border-border-default bg-bg-primary'}`}
                  onPress={() => updateOrder(index, { dir })}
                >
                  <Text className={`text-sm font-medium ${order.dir === dir ? 'text-white' : 'text-text-secondary'}`}>
                    {dir}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <DeleteButton onPress={() => removeOrder(index)} />
          </View>
        ))}
        <AddButton label="+ Ajouter un tri" onPress={addOrder} />
      </Section>
    );
  };

  // ─── Section 8 : LIMIT ──────────────────────────────────────────────────
  const renderLimitSection = () => (
    <Section title="🔢 LIMIT" badge={String(ast.limit)}>
      <TextInput
        className="border border-border-default rounded-lg px-3 py-3 text-base text-text-primary bg-bg-input"
        value={String(ast.limit)}
        onChangeText={(v) => {
          const num = parseInt(v, 10);
          if (!isNaN(num) && num >= 0) updateAst({ limit: num });
        }}
        keyboardType="numeric"
        placeholder="100"
      />
    </Section>
  );

  return (
    <View>
      {renderTableSection()}
      {renderSelectSection()}
      {renderJoinsSection()}
      {renderWhereSection()}
      {renderGroupBySection()}
      {renderHavingSection()}
      {renderOrderBySection()}
      {renderLimitSection()}
    </View>
  );
};
