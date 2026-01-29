const { Pool } = require('pg');

// Reemplaza 'tu_password' con la contraseña real de PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'gestionDeportiva',
    password: 'R@o78965412',
    port: 5432,
});

async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL correctamente');
        console.log('📊 Base de datos: gestionDeportiva');
        
        const result = await client.query('SELECT version()');
        console.log('🔧 Versión de PostgreSQL:', result.rows[0].version);
        
        client.release();
        console.log('🎯 Prueba completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:');
        console.error('🔍 Detalle:', error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verifica que PostgreSQL esté ejecutándose');
        console.log('2. Confirma la contraseña de PostgreSQL');
        console.log('3. Verifica que la base de datos "gestionDeportiva" exista');
        process.exit(1);
    }
}

testConnection();