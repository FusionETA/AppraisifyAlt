/**
 * An in-memory stand-in for the agent's Prisma client. It implements only
 * the read calls the agent repository uses — there is no create / update /
 * delete, so any write attempt fails the test — and it enforces the
 * column-level GRANT the way MySQL would: selecting, filtering or ordering
 * on a column outside AGENT_GRANTED_COLUMNS throws.
 */

import { AGENT_GRANTED_COLUMNS } from "@/modules/agent-api/infrastructure/agent-appraisal.repository"

type Row = Record<string, unknown>
type Table = keyof typeof AGENT_GRANTED_COLUMNS

function deny(table: Table, column: string): never {
  throw new Error(`SELECT command denied for column '${column}' in table '${table}'`)
}

function checkColumns(table: Table, columns: string[]) {
  const granted: readonly string[] = AGENT_GRANTED_COLUMNS[table]
  for (const column of columns) if (!granted.includes(column)) deny(table, column)
}

function whereColumns(where: Row | undefined): string[] {
  if (!where) return []
  return Object.entries(where).flatMap(([key, value]) =>
    key === "OR" || key === "AND" ? (value as Row[]).flatMap(whereColumns) : [key]
  )
}

function comparable(value: unknown) {
  return value instanceof Date ? value.getTime() : value
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Row[]).some((sub) => matches(row, sub))
    if (key === "AND") return (condition as Row[]).every((sub) => matches(row, sub))

    const actual = row[key]
    if (condition === null) return actual === null || actual === undefined
    if (typeof condition !== "object" || condition instanceof Date) return comparable(actual) === comparable(condition)

    const ops = condition as Row
    if (actual === null || actual === undefined) return false
    if ("in" in ops && !(ops.in as unknown[]).includes(actual)) return false
    if ("gte" in ops && !((comparable(actual) as number) >= (comparable(ops.gte) as number))) return false
    if ("lt" in ops && !((comparable(actual) as number) < (comparable(ops.lt) as number))) return false
    if ("contains" in ops && !String(actual).toLowerCase().includes(String(ops.contains).toLowerCase())) return false
    return true
  })
}

type FindArgs = {
  where?: Row
  select: Record<string, boolean>
  orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]
  take?: number
}

export function createFakeAgentDb(tables: { Appraisal: Row[]; Organization: Row[] }) {
  /** When true, ignore `select` and return whole rows — simulates a careless query to prove the mapping layer drops extra columns. */
  const state = { leakWholeRows: false }

  function findMany(table: Table, args: FindArgs) {
    const orderBy = args.orderBy ? [args.orderBy].flat() : []
    checkColumns(table, [
      ...Object.keys(args.select),
      ...whereColumns(args.where),
      ...orderBy.flatMap((o) => Object.keys(o)),
    ])

    let rows = tables[table].filter((row) => matches(row, args.where))

    for (const order of [...orderBy].reverse()) {
      const [[column, direction]] = Object.entries(order)
      rows = [...rows].sort((a, b) => {
        const x = comparable(a[column]) as number | string
        const y = comparable(b[column]) as number | string
        return (x < y ? -1 : x > y ? 1 : 0) * (direction === "desc" ? -1 : 1)
      })
    }

    if (args.take !== undefined) rows = rows.slice(0, args.take)

    return rows.map((row) =>
      state.leakWholeRows ? { ...row } : Object.fromEntries(Object.keys(args.select).map((column) => [column, row[column]]))
    )
  }

  const client = {
    appraisal: {
      findMany: async (args: FindArgs) => findMany("Appraisal", args),
    },
    organization: {
      findMany: async (args: FindArgs) => findMany("Organization", args),
      findUnique: async (args: FindArgs) => findMany("Organization", args)[0] ?? null,
    },
  }

  return { client, state }
}
