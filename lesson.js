const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const LessonCreateRequiredParams = {
  Progress: "Missing Progress",
  TimeTrack: "Missing TimeTrack",
  ContentUrl: "Missing ContentUrl",
  Done: "Missing Done",
  Course_Id: "Missing Course_Id",
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

// Get all lessons on Mysql DB on table lessons paginated
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
      "SELECT * FROM Lesson WHERE User_Id = ? LIMIT ?, ?",
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

// Get lesson by id on Mysql DB on table lessons
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
      "SELECT * FROM Lesson WHERE Id = ? AND User_Id = ?",
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

// Create lesson on Mysql DB on table lessons
module.exports.create = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { Progress, TimeTrack, ContentUrl, Done, Course_Id } =
    JSON.parse(event.body) || null;

  const missingParam = Object.keys(LessonCreateRequiredParams).find(
    (param) => !eval(param)
  );

  if (missingParam) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: LessonCreateRequiredParams[missingParam],
      }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      "INSERT INTO Lesson (Progress, TimeTrack, ContentUrl, Done, Course_Id, User_Id) VALUES (?, ?, ?, ?, ?, ?)",
      [Progress, TimeTrack, ContentUrl, Done, Course_Id, userEmail]
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

// Update lesson on Mysql DB on table lessons
module.exports.patch = async (event) => {
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
    const body = JSON.parse(event.body);

    const fieldsNotAllowed = ["Id", "User_Id", "Course_Id"]; // Fields not allowed for update

    const fieldsToUpdate = {};
    Object.keys(body).forEach((key) => {
      if (!fieldsNotAllowed.includes(key)) {
        fieldsToUpdate[key] = body[key];
      }
    });

    const updateQuery = `UPDATE Lesson SET ? WHERE Id = ? AND User_Id = ?`;
    const updateParams = [fieldsToUpdate, id, userEmail];

    connection.execute(updateQuery, updateParams);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Lesson updated successfully" }),
    };
  } catch (error) {
    console.error("Error updating lesson:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update lesson" }),
    };
  }
};
