import { Client } from "pg"
import { URL } from "url"

/**
 * Automatically creates the database if it doesn't exist on the server.
 * Connects to the default 'postgres' database to perform the check and creation.
 */
export const initDb = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.warn(
      "DATABASE_URL is not defined. Skipping database auto-creation check.",
    )
    return
  }

  try {
    const url = new URL(databaseUrl)
    const dbName = url.pathname.slice(1) // Get database name from the path

    if (!dbName || dbName === "postgres") {
      return // Nothing to create or cannot create 'postgres' itself
    }

    // Temporarily point to 'postgres' database to check for existence of target db
    const rootUrl = new URL(databaseUrl)
    rootUrl.pathname = "/postgres"

    const client = new Client({
      connectionString: rootUrl.toString(),
    })

    await client.connect()

    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    )

    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating it now...`)
      // Database name must be quoted to handle special characters if any
      await client.query(`CREATE DATABASE "${dbName}"`)
    }

    await client.end()
  } catch (error) {
    console.error("Failed to automatically create database:", error)
    // We don't throw here to allow sequelize to try its own connection (which might still fail, providing the original error)
  }
}
