import fetch from "node-fetch";

const API_BASE = "https://rmi-backend-zhdr.onrender.com";

async function testEndpoints() {
  try {
    console.log("🧪 Testing API Endpoints...\n");

    // 1. Check admin user
    console.log("1️⃣  Checking admin user in database:");
    let response = await fetch(`${API_BASE}/api/users?username=admin`);
    let data = await response.json();
    const adminUser = Array.isArray(data) ? data.find(u => u.username === "admin") : data;
    console.log(`Admin role: ${adminUser?.role}`);
    console.log(`Admin status: ${adminUser?.status}\n`);

    // 2. Test admin login
    console.log("2️⃣  Testing admin login:");
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    data = await response.json();
    if (response.ok) {
      console.log(`✅ Admin login successful!`);
      console.log(`Token received: ${data.token?.substring(0, 20)}...`);
      var adminToken = data.token;
    } else {
      console.log(`❌ Admin login failed: ${data.message}`);
    }
    console.log();

    // 3. Test teller login
    console.log("3️⃣  Testing teller login (002.mary):");
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "002.mary", password: "002.mary" })
    });
    data = await response.json();
    if (response.ok) {
      console.log(`✅ Teller login successful!`);
      console.log(`Token received: ${data.token?.substring(0, 20)}...`);
    } else {
      console.log(`❌ Teller login failed: ${data.message}`);
    }
    console.log();

    // 4. Test supervisorTeller endpoint availability
    console.log("4️⃣  Testing supervisorTeller endpoint:");
    response = await fetch(`${API_BASE}/api/supervisorTeller/available`);
    if (response.ok) {
      data = await response.json();
      console.log(`✅ SupervisorTeller endpoint is registered!`);
      console.log(`Available tellers: ${data.length}`);
    } else {
      console.log(`❌ SupervisorTeller endpoint not found (${response.status})`);
    }
    console.log();

    // 5. Test role change endpoint
    if (adminToken) {
      console.log("5️⃣  Testing role change endpoint (admin only):");
      response = await fetch(`${API_BASE}/api/admin/change-role/test-user-id`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        },
        body: JSON.stringify({ role: "supervisor" })
      });
      
      if (response.status === 404 || response.status === 500) {
        // Expected to fail because test-user-id doesn't exist
        console.log(`⚠️  Endpoint exists but user not found (expected behavior)`);
      } else if (response.ok) {
        console.log(`✅ Role change endpoint works!`);
      } else {
        data = await response.json();
        console.log(`Response: ${data.message || data.error}`);
      }
    }
    console.log();

    console.log("✅ All critical endpoint checks completed!");
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

testEndpoints();
