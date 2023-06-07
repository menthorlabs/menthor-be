const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const fetchSettings = {
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
};

const connectionResolver = async () => {
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

async function recursiveFetchGithubDir(url) {
  const map = {};
  try {
    const response = await fetch(url, fetchSettings);
    const data = await response.json();
    const directories = data.filter((item) => item.type === "dir");
    const files = data.filter((item) => item.type === "file");

    if (directories && directories.length > 0) {
      for (const directory of directories) {
        const dirData = await recursiveFetchGithubDir(directory.url);
        if (dirData) {
          map[directory.name] = dirData;
        }
      }
    }

    if (files && files.length > 0) {
      for (const file of files) {
        const fileData = await fetchGithubContents(file.url);
        // delete fileData.content;
        if (fileData) {
          map[file.name] = fileData;
        }
      }
    }

    return map;
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
}

async function fetchGithubContents(url) {
  try {
    const response = await fetch(url, fetchSettings);
    return await response.json();
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
}

// Get all courses on Mysql DB on table courses paginated
module.exports.getAll = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  let { page = 1, size = 10 } = event.queryStringParameters || {
    page: 1,
    size: 10,
  };

  page = parseInt(page);
  size = parseInt(size);

  size = size > 20 ? 20 : size;

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      "SELECT * FROM Course WHERE User_Id = ? LIMIT ?, ?",
      [userEmail, (page - 1) * size, parseInt(size)]
    );
    return {
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};

// Get course by id on Mysql DB on table courses
module.exports.get = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { id } = event.pathParameters || null;
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      "SELECT * FROM Course WHERE Id = ? AND User_Id = ?",
      [id, userEmail]
    );
    return {
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};

module.exports.content = async (event) => {
  const { name } = event.queryStringParameters || null;
  const connection = await connectionResolver();

  if (!name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing name parameter" }),
    };
  }

  try {
    const [rows] = await connection.query(
      "SELECT * FROM GitCache WHERE Term = ? LIMIT 1",
      [name]
    );
    if (rows.length === 0) {
      const root = `https://api.github.com/repos/menthorlabs/Menthor-Aulas/contents/${name}`;

      const data = await recursiveFetchGithubDir(root);

      if (data) {
        connection.query("INSERT INTO GitCache (Term, Value) VALUES (?, ?)", [
          name,
          JSON.stringify(data),
        ]);
      }

      return {
        statusCode: 200,
        body: JSON.stringify(data),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(rows[0].Value),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
