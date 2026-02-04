import { customType } from 'drizzle-orm/pg-core'

/**
 * Custom JSON type for Bun SQL driver compatibility.
 *
 * The default drizzle-orm json() type calls JSON.stringify() before sending to the driver.
 * However, Bun's SQL driver already auto-serializes JavaScript objects for JSON columns.
 * This causes double-encoding: {"foo":"bar"} becomes "{\"foo\":\"bar\"}" (a JSON string).
 *
 * This custom type passes objects directly to the driver, letting Bun handle serialization.
 * See: https://github.com/drizzle-team/drizzle-orm/issues/4385
 */
export const json = <T = unknown>(name: string) =>
  customType<{ data: T; driverData: T | string }>({
    dataType() {
      return 'json'
    },
    // Don't stringify - let Bun's SQL driver handle it
    toDriver(value: T): T {
      return value
    },
    // Handle both correctly-stored JSON and legacy double-encoded strings
    fromDriver(value: T | string): T {
      // If it's a string, it might be double-encoded legacy data
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T
        } catch {
          // Not valid JSON string, return as-is
          return value as T
        }
      }
      // Bun returns parsed JSON objects directly
      return value
    },
  })(name)
