// Script that tests login and fetching user session
async function testLogin() {
    try {
        const resLogin = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'Admin', password: 'admin123' })
        });

        const loginData = await resLogin.json();
        console.log('Login status:', resLogin.status);
        console.log('Login returned:', loginData.username);

        // Get the cookie
        const cookie = resLogin.headers.get('set-cookie');
        if (!cookie) {
            console.error('No cookie received!');
            return;
        }

        const resUser = await fetch('http://localhost:3000/api/user', {
            method: 'GET',
            headers: {
                'Cookie': cookie
            }
        });

        const userData = await resUser.json();
        console.log('User status:', resUser.status);
        console.log('User returned:', userData.username);

    } catch (err) {
        console.error('Error during test:', err);
    }
}

testLogin();
