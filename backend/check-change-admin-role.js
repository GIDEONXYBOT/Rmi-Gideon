// Quick script to change admin user role to super_admin in production database
import axios from 'axios';

// Use the production API endpoint to change the admin role
async function changeAdminToSuperAdmin() {
  try {
    console.log('🔄 Attempting to change admin role to super_admin...');
    console.log('⚠️  Note: This requires an authenticated super_admin or admin user\n');

    // First, get the admin user ID
    const usersRes = await axios.get('https://rmi-backend-zhdr.onrender.com/api/users', {
      timeout: 10000
    });

    const adminUser = usersRes.data.find(u => u.username === 'admin');
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log('Found admin user:');
    console.log('  ID:', adminUser._id);
    console.log('  Username:', adminUser.username);
    console.log('  Current Role:', adminUser.role);
    console.log('');

    // Since we can't authenticate without credentials, provide instructions
    console.log('📋 To change the admin role to super_admin, use this command:');
    console.log('');
    console.log('curl -X PUT https://rmi-backend-zhdr.onrender.com/api/admin/change-role/' + adminUser._id + ' \\');
    console.log('  -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d "{\\"role\\":\\"super_admin\\"}\\""');
    console.log('');
    console.log('OR use this from the backend with local access:');
    console.log('');
    console.log('node backend/change-admin-role.js');

  } catch (e) {
    console.log('Error:', e.message);
  }
}

changeAdminToSuperAdmin();
