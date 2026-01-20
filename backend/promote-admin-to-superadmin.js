// Promote admin user from supervisor to super_admin role
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function promoteAdminToSuperAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const admin = await User.findOne({ username: 'admin' });

    if (!admin) {
      console.log('❌ Admin user with username "admin" not found');
      const users = await User.find({ role: { $in: ['admin', 'supervisor', 'super_admin'] } }).select('username name role').lean();
      console.log('\n📋 Available admin/supervisor users:');
      users.forEach(u => {
        console.log(`  - ${u.username} (${u.name}) - Role: ${u.role}`);
      });
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Found admin user:');
    console.log(`  Username: ${admin.username}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  Current Role: ${admin.role}\n`);

    // Update role to super_admin
    admin.role = 'super_admin';
    await admin.save();

    console.log('✅ Successfully promoted admin to super_admin!\n');
    console.log('📋 Updated user:');
    console.log(`  Username: ${admin.username}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  New Role: ${admin.role}`);
    console.log('\n💡 Admin can now access all super_admin features.');
    console.log('   Please refresh your browser to see the changes.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

promoteAdminToSuperAdmin();
