const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'admin@1234',
        database: 'mydb'
    });

    try {
        const tables = ['return_received', 'return_shipped'];
        const columns = ['article', 'model_name', 'product'];

        for (const table of tables) {
            const [existingColumns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
            const existingNames = existingColumns.map(c => c.Field);

            for (const col of columns) {
                if (!existingNames.includes(col)) {
                    console.log(`Adding ${col} to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${col} VARCHAR(255)`);
                }
            }
        }
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
