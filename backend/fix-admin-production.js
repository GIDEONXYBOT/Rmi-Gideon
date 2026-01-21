// Fix admin user on PRODUCTION database to super_admin
import mongoose from 'mongoose';

async function fixAdminProduction() {
  try {
    const PROD_MONGO_URI = 'mongodb+srv://rmi_admin:lD91v9R6zBcKLDQx@rmi-teller-report.fphrmaw.mongodb.net/?appName=rmi-teller-report';
    
    console.log('🔄 Connecting to PRODUCTION MongoDB Atlas...');
    await mongoose.connect(PROD_MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    console.log('✅ Connected to production database\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find admin user
    const adminUser = await usersCollection.findOne({ username: 'admin' });

    if (!adminUser) {
      console.log('❌ admin user not found on production database');
      const allUsers = await usersCollection.find({
        role: { $in: ['admin', 'supervisor', 'super_admin'] }
      }).toArray();
      console.log('\nAvailable admin/supervisor users:');
      allUsers.forEach(u => console.log(`  - ${u.username} (${u.name || 'N/A'}) - ${u.role}`));
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found admin user on production:');
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

    console.log(`Update result: ${updateResult.modifiedCount} document(s) modified`);

    if (updateResult.modifiedCount > 0) {
      // Verify the update
      const verifyUser = await usersCollection.findOne({ username: 'admin' });
      console.log('\n✅ VERIFICATION - Admin is now:');
      console.log(`  Username: ${verifyUser.username}`);
      console.log(`  Role: ${verifyUser.role}`);
      console.log(`\n🎉 SUCCESS! Admin account is now super_admin on production database`);
    } else {
      console.log('⚠️  No documents were modified');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixAdminProduction();
