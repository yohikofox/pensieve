/**
 * AST → SQL — Convertisseur du Query Builder
 *
 * Transforme un QueryAst en chaîne SQL valide pour OP-SQLite.
 */

import type { QueryAst, WhereCondition, ComparisonOperator } from './QueryAst';

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatOperator(op: ComparisonOperator, val: string): string {
  if (op === 'IS NULL') return 'IS NULL';
  if (op === 'IS NOT NULL') return 'IS NOT NULL';
  if (op === 'LIKE') return `LIKE '${val.replace(/'/g, "''")}'`;
  // Numeric check: if val is a number, don't quote it
  const isNumeric = /^-?\d+(\.\d+)?$/.test(val.trim());
  if (isNumeric) return `${op} ${val}`;
  return `${op} '${val.replace(/'/g, "''")}'`;
}

function buildWherePart(conditions: WhereCondition[]): string {
  if (conditions.length === 0) return '';

  return conditions
    .map((cond, index) => {
      const identifier = escapeIdentifier(cond.col);
      const clause = `${identifier} ${formatOperator(cond.op, cond.val)}`;
      if (index === 0) return clause;
      return `${cond.logic} ${clause}`;
    })
    .join(' ');
}

export function queryAstToSql(ast: QueryAst): string {
  if (!ast.from) return '-- Sélectionnez une table source';

  const parts: string[] = [];

  // SELECT clause
  const selectParts: string[] = [];

  if (ast.select.length > 0) {
    selectParts.push(...ast.select.map(escapeIdentifier));
  }

  if (ast.aggregates.length > 0) {
    selectParts.push(
      ...ast.aggregates.map((agg) => {
        const col = agg.col === '*' ? '*' : escapeIdentifier(agg.col);
        return `${agg.fn}(${col}) AS ${escapeIdentifier(agg.alias)}`;
      })
    );
  }

  const selectClause = selectParts.length > 0 ? selectParts.join(', ') : '*';
  parts.push(`SELECT ${selectClause}`);

  // FROM clause
  parts.push(`FROM ${escapeIdentifier(ast.from)}`);

  // JOIN clauses
  if (ast.joins.length > 0) {
    ast.joins.forEach((join) => {
      parts.push(`${join.type} JOIN ${escapeIdentifier(join.table)} ON ${join.on}`);
    });
  }

  // WHERE clause
  if (ast.where.length > 0) {
    parts.push(`WHERE ${buildWherePart(ast.where)}`);
  }

  // GROUP BY clause
  if (ast.groupBy.length > 0) {
    parts.push(`GROUP BY ${ast.groupBy.map(escapeIdentifier).join(', ')}`);
  }

  // HAVING clause
  if (ast.having) {
    const identifier = escapeIdentifier(ast.having.col);
    parts.push(`HAVING ${identifier} ${formatOperator(ast.having.op, ast.having.val)}`);
  }

  // ORDER BY clause
  if (ast.orderBy.length > 0) {
    const orderParts = ast.orderBy.map(
      (o) => `${escapeIdentifier(o.col)} ${o.dir}`
    );
    parts.push(`ORDER BY ${orderParts.join(', ')}`);
  }

  // LIMIT clause
  if (ast.limit > 0) {
    parts.push(`LIMIT ${ast.limit}`);
  }

  return parts.join('\n');
}
