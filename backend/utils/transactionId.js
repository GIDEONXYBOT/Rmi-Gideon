/**
 * Utility functions for generating unique transaction IDs for payroll entries
 */

/**
 * Generate a unique transaction ID for a payroll entry
 * Format: ${userId}_${date}_${timestamp}_${randomId}
 * 
 * @param {String} userId - The user ID (ObjectId as string)
 * @param {String} date - The date in YYYY-MM-DD format
 * @returns {String} A unique transaction ID
 */
export function generateTransactionId(userId, date) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10); // 8 character random string
  return `${userId}_${date}_${timestamp}_${randomId}`;
}

/**
 * Generate a migration transaction ID for existing payroll entries
 * Format: ${userId}_${date}_${createdAtTimestamp}_MIGRATED
 * 
 * @param {String} userId - The user ID (ObjectId as string)
 * @param {String} date - The date in YYYY-MM-DD format
 * @param {Date} createdAt - The original creation date
 * @returns {String} A migration transaction ID
 */
export function generateMigrationTransactionId(userId, date, createdAt) {
  const timestamp = createdAt ? createdAt.getTime() : Date.now();
  return `${userId}_${date}_${timestamp}_MIGRATED`;
}
