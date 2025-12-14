/**
 * Migration Script: Add transactionId to existing payroll entries
 * 
 * This script adds a unique transactionId to all payroll entries that don't have one.
 * For existing records, we use the format: ${userId}_${date}_${createdAt.getTime()}_MIGRATED
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import { generateMigrationTransactionId } from './utils/transactionId.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function migratePayrollTransactionIds() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all payrolls without a transactionId
    const payrollsWithoutTxId = await Payroll.find({
      $or: [
        { transactionId: { $exists: false } },
        { transactionId: null },
        { transactionId: '' }
      ]
    });

    console.log(`Found ${payrollsWithoutTxId.length} payroll entries without transactionId\n`);

    if (payrollsWithoutTxId.length === 0) {
      console.log('✅ All payroll entries already have transactionIds. Migration not needed.');
      await mongoose.disconnect();
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const payroll of payrollsWithoutTxId) {
      try {
        // Use date field if available, otherwise derive from createdAt
        const date = payroll.date || (payroll.createdAt ? payroll.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        
        // Generate migration transactionId
        const transactionId = generateMigrationTransactionId(
          payroll.user.toString(),
          date,
          payroll.createdAt
        );

        // Update the payroll entry
        payroll.transactionId = transactionId;
        
        // Also ensure date field is set
        if (!payroll.date) {
          payroll.date = date;
        }

        await payroll.save();
        updated++;

        if (updated % 100 === 0) {
          console.log(`✅ Migrated ${updated} payroll entries...`);
        }
      } catch (err) {
        console.error(`❌ Failed to migrate payroll ${payroll._id}:`, err.message);
        failed++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total processed: ${payrollsWithoutTxId.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Migration complete. Disconnected from MongoDB.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
migratePayrollTransactionIds();
