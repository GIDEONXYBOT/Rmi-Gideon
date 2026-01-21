// Fix superadmin user role from admin to super_admin
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixSuperAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find superadmin user
    const superadmin = await usersCollection.findOne({ username: 'superadmin' });

    if (!superadmin) {
      console.log('❌ superadmin user not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found superadmin user:');
    console.log(`  Username: ${superadmin.username}`);
    console.log(`  Name: ${superadmin.name}`);
    console.log(`  Current Role: ${superadmin.role}\n`);

    // Update role to super_admin
    const result = await usersCollection.updateOne(
      { username: 'superadmin' },
      { $set: { role: 'super_admin' } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Successfully changed superadmin to super_admin!\n');

      // Verify
      const updated = await usersCollection.findOne({ username: 'superadmin' });
      console.log('📋 Updated user:');
      console.log(`  Username: ${updated.username}`);
      console.log(`  New Role: ${updated.role}`);
    } else {
      console.log('⚠️ No changes made - already super_admin');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixSuperAdmin();
