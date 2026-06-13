/**
 * Malloy query parser and builder.
 *
 * Supports the run-pipeline syntax:
 *   run: <source> -> {
 *     group_by:
 *       FieldName
 *       `Field With Spaces`
 *     aggregate:
 *       `Total Revenue`
 *     where: Category ~ f`x`
 *     order_by: `Product Name` desc
 *     limit: 100
 *   }
 */

// ── AST types ─────────────────────────────────────────────────────────────────

export interface WhereClause {
  /** Left-hand field name (un-backticked) */
  field: string
  /** Operator string, e.g. "~", "=", "!=", ">", "<", "!~" */
  operator: string
  /** Right-hand value as a raw string */
  value: string
  /** Full original expression, preserved for round-trip fidelity */
  raw: string
}

export interface OrderByClause {
  /** Field name (un-backticked) */
  field: string
  direction: 'asc' | 'desc'
}

export interface MalloyQueryAST {
  /** Source / view name, e.g. "order_items" */
  source: string
  groupBy:   string[]
  aggregate: string[]
  select:    string[]
  where:     WhereClause[]
  orderBy:   OrderByClause[]
  limit?:    number
}

// ── Field name helpers ────────────────────────────────────────────────────────

/** Strip backticks from a field token, return the inner name. */
export function unquote(token: string): string {
  token = token.trim()
  if (token.startsWith('`') && token.endsWith('`')) return token.slice(1, -1)
  return token
}

/** Wrap a field name in backticks if it contains spaces or special chars. */
export function quote(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name}\``
}

// ── Clause keyword detection ──────────────────────────────────────────────────

type ClauseKey = 'group_by' | 'aggregate' | 'select' | 'where' | 'order_by' | 'limit'

const CLAUSE_PATTERN = /^(group_by|aggregate|select|where|order_by|limit)\s*:(.*)/

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a Malloy `run:` query string into a structured AST.
 * Returns `null` if the string does not match the expected shape.
 */
export function parseQuery(query: string): MalloyQueryAST | null {
  const trimmed = query.trim()

  // Match outer: run: <source> -> { <body> }
  const outerMatch = trimmed.match(/^run\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*\{([\s\S]*)\}\s*$/)
  if (!outerMatch) return null

  const source = outerMatch[1]
  const bodyLines = outerMatch[2].split('\n').map(l => l.trim()).filter(Boolean)

  const ast: MalloyQueryAST = {
    source,
    groupBy:   [],
    aggregate: [],
    select:    [],
    where:     [],
    orderBy:   [],
  }

  let currentClause: ClauseKey | null = null
  // Accumulate inline (same-line) content for single-value clauses
  const inlineBuffer: Partial<Record<ClauseKey, string[]>> = {}

  for (const line of bodyLines) {
    const clauseMatch = line.match(CLAUSE_PATTERN)

    if (clauseMatch) {
      currentClause = clauseMatch[1] as ClauseKey
      const inline = clauseMatch[2].trim()
      if (inline) {
        inlineBuffer[currentClause] ??= []
        inlineBuffer[currentClause]!.push(inline)
      }
      continue
    }

    // Continuation line — belongs to current clause
    if (currentClause && line) {
      inlineBuffer[currentClause] ??= []
      inlineBuffer[currentClause]!.push(line)
    }
  }

  // ── Process each clause's accumulated lines ───────────────────────────────

  for (const [key, lines] of Object.entries(inlineBuffer) as [ClauseKey, string[]][]) {
    switch (key) {
      case 'group_by':
        ast.groupBy = lines.map(unquote)
        break

      case 'aggregate':
        ast.aggregate = lines.map(unquote)
        break

      case 'select':
        ast.select = lines.map(unquote)
        break

      case 'where':
        ast.where = lines.map(parseWhereClause).filter(Boolean) as WhereClause[]
        break

      case 'order_by':
        ast.orderBy = lines.map(parseOrderByClause).filter(Boolean) as OrderByClause[]
        break

      case 'limit': {
        const n = parseInt(lines[0], 10)
        if (!isNaN(n)) ast.limit = n
        break
      }
    }
  }

  return ast
}

// ── Where clause parser ───────────────────────────────────────────────────────

/**
 * Parse a single where expression.
 *
 * Examples:
 *   Category ~ f`x`
 *   `Product Name` != null
 *   price > 100
 */
function parseWhereClause(raw: string): WhereClause | null {
  raw = raw.trim()
  if (!raw) return null

  // Operators ordered longest-first to avoid partial matches
  const OPERATORS = ['!~', '>=', '<=', '!=', '~', '>', '<', '=']

  // Field token: backtick-quoted or plain identifier
  const fieldPattern = /^(`[^`]+`|[A-Za-z_][A-Za-z0-9_.]*)\s*/
  const fieldMatch = raw.match(fieldPattern)
  if (!fieldMatch) return { field: '', operator: '', value: raw, raw }

  const fieldToken = fieldMatch[0].trimEnd()
  const rest = raw.slice(fieldToken.length).trimStart()

  for (const op of OPERATORS) {
    if (rest.startsWith(op)) {
      const value = rest.slice(op.length).trim()
      return { field: unquote(fieldToken.trim()), operator: op, value, raw }
    }
  }

  // No operator found — treat the whole expression as raw
  return { field: unquote(fieldToken.trim()), operator: '', value: rest, raw }
}

// ── Order-by clause parser ────────────────────────────────────────────────────

/**
 * Parse a single order_by item.
 *
 * Examples:
 *   `Product Name` desc
 *   carrier asc
 *   flight_count
 */
function parseOrderByClause(raw: string): OrderByClause | null {
  raw = raw.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  let direction: 'asc' | 'desc' = 'asc'
  let fieldPart = raw

  if (lower.endsWith(' desc')) {
    direction = 'desc'
    fieldPart = raw.slice(0, raw.length - 5).trim()
  } else if (lower.endsWith(' asc')) {
    fieldPart = raw.slice(0, raw.length - 4).trim()
  }

  return { field: unquote(fieldPart), direction }
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Serialise a `MalloyQueryAST` back to a formatted Malloy query string.
 */
export function buildQuery(ast: MalloyQueryAST): string {
  if (!ast.source) return ''

  const lines: string[] = []

  if (ast.groupBy.length > 0) {
    lines.push('  group_by:')
    ast.groupBy.forEach(f => lines.push(`    ${quote(f)}`))
  }

  if (ast.aggregate.length > 0) {
    lines.push('  aggregate:')
    ast.aggregate.forEach(f => lines.push(`    ${quote(f)}`))
  }

  if (ast.select.length > 0) {
    lines.push('  select:')
    ast.select.forEach(f => lines.push(`    ${quote(f)}`))
  }

  ast.where.forEach(w => {
    lines.push(`  where: ${w.raw}`)
  })

  if (ast.orderBy.length > 0) {
    lines.push('  order_by:')
    ast.orderBy.forEach(o => lines.push(`    ${quote(o.field)} ${o.direction}`))
  }

  if (ast.limit !== undefined) {
    lines.push(`  limit: ${ast.limit}`)
  }

  return `run: ${ast.source} -> {\n${lines.join('\n')}\n}`
}

// ── Convenience: add / remove fields ─────────────────────────────────────────

/** Add a where clause to an AST (avoids duplicates on same field+op). */
export function addWhere(ast: MalloyQueryAST, clause: WhereClause): MalloyQueryAST {
  const filtered = ast.where.filter(w => !(w.field === clause.field && w.operator === clause.operator))
  return { ...ast, where: [...filtered, clause] }
}

/** Remove all where clauses for a given field. */
export function removeWhere(ast: MalloyQueryAST, field: string): MalloyQueryAST {
  return { ...ast, where: ast.where.filter(w => w.field !== field) }
}

/** Toggle sort direction or add order_by for a field. */
export function toggleOrderBy(ast: MalloyQueryAST, field: string): MalloyQueryAST {
  const existing = ast.orderBy.find(o => o.field === field)
  if (!existing) {
    return { ...ast, orderBy: [...ast.orderBy, { field, direction: 'desc' }] }
  }
  if (existing.direction === 'desc') {
    return { ...ast, orderBy: ast.orderBy.map(o => o.field === field ? { ...o, direction: 'asc' } : o) }
  }
  // Was asc — remove it
  return { ...ast, orderBy: ast.orderBy.filter(o => o.field !== field) }
}

/** Build a fresh AST from selected fields (dimensions → group_by, measures → aggregate). */
export function astFromFields(
  source: string,
  fields: Array<{ name: string; type: string }>,
): MalloyQueryAST {
  return {
    source,
    groupBy:   fields.filter(f => f.type === 'dimension').map(f => f.name),
    aggregate: fields.filter(f => f.type === 'measure').map(f => f.name),
    select:    fields.filter(f => f.type !== 'dimension' && f.type !== 'measure').map(f => f.name),
    where:     [],
    orderBy:   [],
  }
}
