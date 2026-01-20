// Direct script to change admin role to super_admin in production MongoDB
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function changeAdminRole() {
  try {
    console.log('🔄 Connecting to production MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.log('❌ MongoDB URI not found in .env');
      console.log('Please ensure MONGODB_URI or MONGO_URI is set in your .env file');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find admin user
    const adminUser = await usersCollection.findOne({ username: 'admin' });

    if (!adminUser) {
      console.log('❌ Admin user with username "admin" not found\n');
      
      // Show available admin/supervisor users
      const adminUsers = await usersCollection.find({
        role: { $in: ['admin', 'supervisor', 'super_admin'] }
      }).toArray();
      
      console.log('📋 Available admin/supervisor users:');
      adminUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.name || 'N/A'}) - Role: ${u.role}`);
      });
      
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found admin user:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Name: ${adminUser.name || 'N/A'}`);
    console.log(`  Current Role: ${adminUser.role}`);
    console.log('');

    // Update admin role to super_admin
    const result = await usersCollection.updateOne(
      { username: 'admin' },
      { $set: { role: 'super_admin' } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Successfully changed admin role to super_admin!\n');

      // Verify the change
      const updated = await usersCollection.findOne({ username: 'admin' });
      console.log('📋 Updated user:');
      console.log(`  Username: ${updated.username}`);
      console.log(`  New Role: ${updated.role}`);
      console.log('');
      console.log('💡 Please refresh your browser or log out and log back in to see the changes.');
    } else {
      console.log('⚠️ No changes were made. Admin might already be super_admin or username not found.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Connection issues - ensure you have internet access to MongoDB Atlas');
    }
    process.exit(1);
  }
}

changeAdminRole();
