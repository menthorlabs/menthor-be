const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const CourseCreateRequiredParams = {
  Progress: "Missing Progress",
  CurrentLessonUrl: "Missing ContentUrl",
  Done: "Missing Done",
};

const fieldsToDelete = [
  "size",
  "url",
  "html_url",
  "git_url",
  "download_url",
  "_links",
  "sha",
];

const fetchSettings = {
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
};

const normalizePath = (path) => {
  return path
    .replace(/\d+\s/g, "")
    .replace(/\//g, "-")
    .replace(/\s/g, "-")
    .replace(/-{3,}/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeName = (name) => {
  return name.replace(/\.[^/.]+$/, "").replace(/\d+\s-\s/g, "");
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
        if (fileData.content && !file.name.endsWith(".png")) {
          fileData.content = Buffer.from(fileData.content, "base64").toString(
            "utf-8"
          );
        }
        fieldsToDelete.forEach((field) => {
          delete fileData[field];
        });
        fileData.name = normalizeName(fileData.name);
        fileData.path = normalizePath(fileData.path);
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
  const { courseId } = event.pathParameters || null;
  if (!courseId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    console.log(courseId, userEmail);
    const [rows] = await connection.query(
      "SELECT * FROM Course WHERE Id = ? AND User_Id = ?",
      [courseId, userEmail]
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

// Get last accessed courses (UpdatedAt) on Mysql DB on table courses
module.exports.getLastAccessed = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { size = 10 } = event.queryStringParameters || { size: 10 };

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      "SELECT * FROM Course WHERE User_Id = ? ORDER BY UpdatedAt DESC LIMIT ?",
      [userEmail, parseInt(size)]
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

// Create a new course on Mysql DB on table courses
module.exports.create = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { Progress, ContentUrl, CurrentLessonUrl, Done } =
    JSON.parse(event.body) || null;

  const missingParam = Object.keys(CourseCreateRequiredParams).find(
    (param) => !eval(param)
  );

  if (missingParam) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: CourseCreateRequiredParams[missingParam],
      }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      "INSERT INTO Course (Progress, ContentUrl, CurrentLessonUrl, Done, User_Id) VALUES (?, ?, ?, ?, ?)",
      [Progress, ContentUrl, CurrentLessonUrl, Done, userEmail]
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

// Update a course on Mysql DB on table courses
module.exports.patch = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { courseId } = event.pathParameters || null;
  if (!courseId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();
  // Use the connection
  try {
    const body = JSON.parse(event.body);

    const fieldsNotAllowed = ["id", "User_Id"]; // Fields not allowed for update

    const fieldsToUpdate = {};
    Object.keys(body).forEach((key) => {
      if (!fieldsNotAllowed.includes(key)) {
        fieldsToUpdate[key] = body[key];
      }
    });

    const updateQuery = `UPDATE Course SET ? WHERE Id = ? AND User_Id = ?`;
    const updateParams = [fieldsToUpdate, courseId, userEmail];

    connection.execute(updateQuery, updateParams);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Course updated successfully" }),
    };
  } catch (error) {
    console.error("Error updating course:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update course" }),
    };
  }
};
