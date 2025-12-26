# Payroll Transaction ID Migration

## Overview

This document explains the changes made to add unique transaction IDs to payroll entries to prevent unwanted merging of multiple transactions for the same user on the same day.

## Problem

Previously, the payroll system used `findOneAndUpdate` with `upsert: true` using only `user` and `date` fields for uniqueness checking. This caused multiple payroll entries for the same user on the same day to be merged into a single entry, losing important transaction details.

## Solution

We added a unique `transactionId` field to each payroll entry with the format:
```
${userId}_${date}_${timestamp}_${randomId}
```

This ensures each transaction creates a separate payroll record.

## Changes Made

### 1. Payroll Model (`backend/models/Payroll.js`)
- Added `transactionId` field with sparse unique index
- Added comprehensive documentation comments
- The sparse index allows existing records without `transactionId` (null values) while enforcing uniqueness for new records

### 2. Transaction ID Utility (`backend/utils/transactionId.js`)
- `generateTransactionId(userId, date)`: Generates unique IDs for new payroll entries
- `generateMigrationTransactionId(userId, date, createdAt)`: Generates deterministic IDs for existing entries during migration

### 3. Updated Payroll Creation Logic

The following files were updated to generate unique `transactionId` when creating payrolls:
- `backend/routes/teller-management.js`: Teller and supervisor payroll creation
- `backend/routes/shift.js`: Shift-based payroll creation
- `backend/routes/payroll.js`: Weekly payroll sync
- `backend/routes/tellerReports.js`: Report-based payroll creation
- `backend/routes/reports.js`: Report override payroll creation
- `backend/routes/admin.js`: Admin-initiated payroll creation

### 4. Migration Script (`backend/migrate-payroll-transaction-ids.js`)
A standalone script to add `transactionId` to existing payroll entries that don't have one.

## Running the Migration

To migrate existing payroll entries:

```bash
cd backend
node migrate-payroll-transaction-ids.js
```

The script will:
1. Find all payroll entries without a `transactionId`
2. Generate a unique migration ID for each: `${userId}_${date}_${createdAt.getTime()}_MIGRATED`
3. Update each entry with the generated ID
4. Also ensure the `date` field is set for all entries

## Testing

Run the test suite to verify functionality:

```bash
cd backend
npm test
```

The tests verify:
- Transaction ID generation produces unique IDs
- Different users/dates get different IDs
- Migration IDs are deterministic for the same inputs

## Impact on Existing Code

### Query Compatibility ✅
All existing queries continue to work because:
- Queries by `user` field remain unchanged
- Queries by `date` field remain unchanged
- The `transactionId` is only used when creating/updating specific transactions

### Multiple Entries per User/Day ✅
- Multiple payroll entries can now exist for the same user on the same day
- Each entry has a unique `transactionId`
- Daily/weekly/monthly breakdowns work by grouping on the `date` field

### Backwards Compatibility ✅
- Old payroll entries without `transactionId` are handled gracefully
- The sparse index allows null values for old records
- Queries don't require `transactionId` to be present

## API Response Changes

The `transactionId` field is now included in API responses for payroll entries. Frontend code doesn't need changes but can optionally use this field for:
- Displaying transaction-specific details
- Identifying specific transactions for updates/deletions
- Tracking multiple transactions per day

## Best Practices

When creating new payroll entries:

1. **Always generate a transactionId**:
   ```javascript
   import { generateTransactionId } from "../utils/transactionId.js";
   
   const transactionId = generateTransactionId(userId.toString(), date);
   ```

2. **Set the date field** (YYYY-MM-DD format):
   ```javascript
   const date = new Date().toISOString().split('T')[0];
   ```

3. **Check if payroll exists by date** (not just createdAt range):
   ```javascript
   const existing = await Payroll.findOne({ user: userId, date: date });
   ```

4. **Create new entries instead of using upsert**:
   ```javascript
   if (!existing) {
     const payroll = new Payroll({
       user: userId,
       date: date,
       transactionId: transactionId,
       // ... other fields
     });
     await payroll.save();
   }
   ```

## Rollback Plan

If issues arise, the changes can be rolled back:

1. The `transactionId` field is optional (sparse index)
2. Old code that doesn't set `transactionId` will still work
3. The migration script can be re-run safely (it's idempotent)

However, note that:
- Removing the unique index would allow duplicate entries again
- Rolling back the code changes would restore the original merging behavior

## Future Considerations

- Consider adding `transactionId` to API filters for transaction-specific queries
- Add UI to display multiple transactions per day separately
- Consider archiving or consolidating very old entries without `transactionId`
