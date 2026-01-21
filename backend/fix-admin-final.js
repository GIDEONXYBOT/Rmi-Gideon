// Fix admin user - change from supervisor to super_admin
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find admin user by username
    const adminUser = await usersCollection.findOne({ username: 'admin' });

    if (!adminUser) {
      console.log('❌ admin user not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found admin user:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Current Role: ${adminUser.role}`);
    console.log(`  ID: ${adminUser._id}\n`);

    // Force update role to super_admin
    const updateResult = await usersCollection.updateOne(
      { _id: adminUser._id },
      { 
        $set: { 
          role: 'super_admin',
          updatedAt: new Date()
        } 
      }
    );

    console.log(`Update result: ${updateResult.modifiedCount} documents modified`);

    // Verify the update
    const verifyUser = await usersCollection.findOne({ username: 'admin' });
    console.log('\n✅ Verification:');
    console.log(`  Username: ${verifyUser.username}`);
    console.log(`  Role: ${verifyUser.role}`);
    console.log(`  Status: ${verifyUser.role === 'super_admin' ? '✅ NOW SUPER_ADMIN' : '❌ STILL NOT SUPER_ADMIN'}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixAdmin();
