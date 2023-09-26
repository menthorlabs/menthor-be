const mysql = require('mysql2/promise');
const util = require('util');

let CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const connectionResolver = async () => {
  if (CONNECTION && CONNECTION.state !== 'disconnected') {
    return CONNECTION;
  }
  CONNECTION = mysql.createConnection(process.env.DATABASE_URL);
  CONNECTION.query = util.promisify(CONNECTION.query);

  try {
    await CONNECTION.connect();
    return CONNECTION;
  } catch (err) {
    console.error('Database connection failed: ', err.stack);
    throw err;
  }
};

module.exports = connectionResolver;
