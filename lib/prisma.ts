import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { getDatabaseConnectionConfig } from "@/lib/database-config"

import { PrismaClient } from "@/generated/prisma/client"

declare global {
  // eslint-disable-next-line no-var
  var prismaClientSingleton: PrismaClient | undefined
}

function createPrismaClient() {
  const config = getDatabaseConnectionConfig()

  if (!config) {
    return null
  }

  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 15,
    ssl: config.ssl,
    // Ping a connection that has been idle for >500ms before handing it out —
    // detects connections a remote DB has silently closed.
    minDelayValidation: 500,
    // Drop connections idle for more than 60s — managed MySQL hosts often
    // close idle TCP connections server-side.
    idleTimeout: 60,
    connectTimeout: 10000,
    acquireTimeout: 15000,
  })

  return new PrismaClient({
    adapter,
  })
}

export function getPrismaClient() {
  if (globalThis.prismaClientSingleton) {
    return globalThis.prismaClientSingleton
  }

  const client = createPrismaClient()

  if (client) {
    globalThis.prismaClientSingleton = client
    void client.$connect().catch(() => undefined)
  }

  return client
}
