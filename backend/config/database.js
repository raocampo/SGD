const {Pool} = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gestionDeportiva',
  password: 'R@o78965412',
  port: 5432,
});

/*pool.connect((err, client, release) => {
  if(err){
    console.error('Error conectando a PostgreSql', err.message);
  }else{
    console.log('Conectado a PostgreSQL correctamente');
    console.log('Base de datos: gestionDeportiva');
    release();
  }
});*/

pool.on('error', (err, client) => {
    console.error('❌ Error inesperado en la base de datos:', err);
});

console.log('📊 Configuración de base de datos cargada');

module.exports = pool;