// Script to create the admin demo user
// Usage: node scripts/create-admin.cjs
const bcrypt = require('bcryptjs');

async function main() {
    // We need to connect directly to the database
    const { Pool } = require('pg');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:Rocketflow2026!@localhost:5432/rocketflow'
    });

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const id = require('crypto').randomUUID();

        // Check if admin user already exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            ['Admin']
        );

        if (existing.rows.length > 0) {
            console.log('Admin user already exists. Updating password...');
            await pool.query(
                'UPDATE users SET password = $1, is_primary = true, role = $2, updated_at = NOW() WHERE username = $3',
                [hashedPassword, 'admin', 'Admin']
            );
            console.log('Admin password updated to: admin123');
        } else {
            // Create the admin user
            await pool.query(
                `INSERT INTO users (id, username, full_name, password, is_primary, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                [id, 'Admin', 'Administrador', hashedPassword, true, 'admin']
            );
            console.log('Admin user created successfully!');
        }

        console.log('  Username: Admin');
        console.log('  Password: admin123');
        console.log('  Role:     admin (primary)');
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await pool.end();
    }
}

main();
