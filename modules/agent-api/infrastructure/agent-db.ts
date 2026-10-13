import "server-only"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { getAgentDatabaseConnectionConfig } from "@/lib/database-config"

import { PrismaClient } from "@/generated/prisma/client"

declare global {
  var agentPrismaClientSingleton: PrismaClient | undefined
}

/**
 * A second Prisma client, separate from lib/prisma.ts, that logs in as the
 * read-only agent user (see getAgentDatabaseConnectionConfig). That user's
 * column-level GRANT is the real guarantee; the session is also opened
 * READ ONLY so a write would fail even if the user were over-granted.
 */
function createAgentPrismaClient() {
  const config = getAgentDatabaseConnectionConfig()

  if (!config) {
    return null
  }

  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
    connectionLimit: 3,
    initSql: "SET SESSION TRANSACTION READ ONLY",
    minDelayValidation: 500,
    idleTimeout: 60,
    connectTimeout: 10000,
    acquireTimeout: 15000,
  })

  return new PrismaClient({ adapter })
}

export function isAgentDatabaseConfigured() {
  return Boolean(getAgentDatabaseConnectionConfig())
}

export function getAgentPrismaClient() {
  if (globalThis.agentPrismaClientSingleton) {
    return globalThis.agentPrismaClientSingleton
  }

  const client = createAgentPrismaClient()

  if (client) {
    globalThis.agentPrismaClientSingleton = client
  }

  return client
}
