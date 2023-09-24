const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

export const connectionResolver = async () => {
  if (CONNECTION && CONNECTION.state !== "disconnected") {
    return CONNECTION;
  } else {
    CONNECTION = mysql.createConnection(connectionString);
    CONNECTION.query = util.promisify(CONNECTION.query);

    try {
      await CONNECTION.connect();
      return CONNECTION;
    } catch (err) {
      console.error("Database connection failed: ", err.stack);
      throw err;
    }
  }
};
