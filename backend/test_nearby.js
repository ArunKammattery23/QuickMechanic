async function test() {
  try {
    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arunedakkulam@gmail.com', password: 'AK12345' })
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token || loginData.accessToken;
    
    const nearbyRes = await fetch('http://localhost:3000/dispatch/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: 10.02, lng: 76.32, serviceType: 'flat_tire' })
    });
    
    const nearbyData = await nearbyRes.json();
    console.log(JSON.stringify(nearbyData, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
