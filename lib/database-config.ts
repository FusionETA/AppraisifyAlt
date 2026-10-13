type DatabaseConnectionConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl?: boolean | { rejectUnauthorized: boolean }
}

function parseBoolean(value: string | undefined) {
  if (!value) {
    return undefined
  }

  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  return undefined
}

function parseSslConfig(input: {
  sslMode?: string | null
  sslAccept?: string | null
  sslEnabled?: string
  rejectUnauthorized?: string
}) {
  const sslMode = input.sslMode?.toLowerCase()
  const sslAccept = input.sslAccept?.toLowerCase()
  const sslEnabled = parseBoolean(input.sslEnabled)
  const rejectUnauthorized = parseBoolean(input.rejectUnauthorized)

  if (sslAccept === "strict") {
    return true
  }

  if (sslAccept === "accept_invalid_certs") {
    return { rejectUnauthorized: false }
  }

  if (sslMode === "required" || sslMode === "require" || sslMode === "strict") {
    return true
  }

  if (sslMode === "accept_invalid_certs" || sslMode === "insecure") {
    return { rejectUnauthorized: false }
  }

  if (sslEnabled === true) {
    if (rejectUnauthorized === false) {
      return { rejectUnauthorized: false }
    }

    return true
  }

  return undefined
}

function parseUrlConnection() {
  const connectionUrl = process.env.DATABASE_URL

  if (!connectionUrl) {
    return null
  }

  try {
    const url = new URL(connectionUrl)
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      ssl: parseSslConfig({
        sslMode: url.searchParams.get("sslmode"),
        sslAccept: url.searchParams.get("sslaccept"),
      }),
    }
  } catch {
    return null
  }
}

export function getDatabaseConnectionConfig(): DatabaseConnectionConfig | null {
  const parsed = parseUrlConnection()

  if (parsed?.host && parsed.user && parsed.password && parsed.database) {
    return parsed
  }

  if (
    process.env.DATABASE_HOST &&
    process.env.DATABASE_USER &&
    process.env.DATABASE_PASSWORD &&
    process.env.DATABASE_NAME
  ) {
    return {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || 3306),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      ssl: parseSslConfig({
        sslMode: process.env.DATABASE_SSL_MODE ?? process.env.DATABASE_SSLMODE,
        sslEnabled: process.env.DATABASE_SSL,
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
      }),
    }
  }

  return null
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseConnectionConfig())
}

/**
 * Connection for the read-only agent API (modules/agent-api). Credentials
 * come ONLY from AGENT_DB_USER / AGENT_DB_PASSWORD — never from the main
 * connection — so a missing agent login fails closed instead of quietly
 * running agent queries as the app's read-write user. For the same reason,
 * reusing the main user here is treated as not configured.
 *
 * Host, port, database name and SSL default to the main connection's (it's
 * the same server); AGENT_DB_HOST / AGENT_DB_PORT / AGENT_DB_NAME /
 * AGENT_DB_SSL_MODE override them.
 */
export function getAgentDatabaseConnectionConfig(): DatabaseConnectionConfig | null {
  const user = process.env.AGENT_DB_USER
  const password = process.env.AGENT_DB_PASSWORD

  if (!user || !password) {
    return null
  }

  const main = getDatabaseConnectionConfig()

  if (main && main.user === user) {
    return null
  }

  const host = process.env.AGENT_DB_HOST || main?.host
  const database = process.env.AGENT_DB_NAME || main?.database

  if (!host || !database) {
    return null
  }

  return {
    host,
    port: Number(process.env.AGENT_DB_PORT || main?.port || 3306),
    user,
    password,
    database,
    ssl: process.env.AGENT_DB_SSL_MODE
      ? parseSslConfig({ sslMode: process.env.AGENT_DB_SSL_MODE })
      : main?.ssl,
  }
}
