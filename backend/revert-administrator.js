// Revert administrator user from supervisor back to super_admin
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function revertAdministrator() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find administrator user (check both username and name fields)
    let adminUser = await usersCollection.findOne({ username: 'administrator' });
    if (!adminUser) {
      adminUser = await usersCollection.findOne({ name: 'Administrator' });
    }

    if (!adminUser) {
      console.log('❌ Administrator user not found\n');
      
      // Show available admin/supervisor users
      const admins = await usersCollection.find({
        role: { $in: ['admin', 'supervisor', 'super_admin'] }
      }).toArray();
      
      console.log('📋 Available admin/supervisor users:');
      admins.forEach(u => {
        console.log(`  - ${u.username} (${u.name || 'N/A'}) - Role: ${u.role}`);
      });
      
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found administrator user:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Name: ${adminUser.name || 'N/A'}`);
    console.log(`  Current Role: ${adminUser.role}\n`);

    // Update role to super_admin
    const result = await usersCollection.updateOne(
      { _id: adminUser._id },
      { $set: { role: 'super_admin' } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Successfully reverted to super_admin!\n');

      // Verify
      const updated = await usersCollection.findOne({ _id: adminUser._id });
      console.log('📋 Updated user:');
      console.log(`  Username: ${updated.username}`);
      console.log(`  New Role: ${updated.role}`);
      console.log('\n💡 Changes will take effect on next login or page refresh');
    } else {
      console.log('⚠️ No changes made - user might already be super_admin');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

revertAdministrator();
