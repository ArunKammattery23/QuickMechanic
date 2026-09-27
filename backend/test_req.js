async function test() {
  try {
    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arunedakkulam@gmail.com', password: 'AK12345' })
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token || loginData.accessToken;
    
    const reqRes = await fetch('http://localhost:3000/dispatch/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: 10.02, lng: 76.32, serviceType: 'flat_tire', mechanicId: '8b59a123-f2fe-412c-8492-7644a278bc02' })
    });
    
    console.log(await reqRes.json());
  } catch (err) {
    console.error(err);
  }
}
test();
