/**
 * Query AST — Types TypeScript pour le Query Builder
 *
 * Définit la structure JSON de l'AST stocké dans debug_saved_queries.query_ast
 */

export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
export type JoinType = 'LEFT' | 'INNER';
export type OrderDirection = 'ASC' | 'DESC';
export type LogicOperator = 'AND' | 'OR';
export type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';

export interface AggregateColumn {
  fn: AggregateFunction;
  col: string;
  alias: string;
}

export interface JoinClause {
  type: JoinType;
  table: string;
  on: string;
}

export interface WhereCondition {
  col: string;
  op: ComparisonOperator;
  val: string;
  logic: LogicOperator;
}

export interface OrderByClause {
  col: string;
  dir: OrderDirection;
}

export interface HavingCondition {
  col: string;
  op: ComparisonOperator;
  val: string;
}

export interface QueryAst {
  from: string;
  select: string[];
  aggregates: AggregateColumn[];
  joins: JoinClause[];
  where: WhereCondition[];
  groupBy: string[];
  having: HavingCondition | null;
  orderBy: OrderByClause[];
  limit: number;
}

export const DEFAULT_QUERY_AST: QueryAst = {
  from: '',
  select: [],
  aggregates: [],
  joins: [],
  where: [],
  groupBy: [],
  having: null,
  orderBy: [],
  limit: 100,
};

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  query_ast: QueryAst;
  created_at: number;
  updated_at: number;
}
