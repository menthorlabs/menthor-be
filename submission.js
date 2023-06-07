const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const SubmissionCreateRequiredParams = {
  Content: "Missing Content",
  SubmissionType: "Missing SubmissionType",
  SubmissionStatus: "Missing SubmissionStatus",
  LessonUrl: "Missing LessonUrl",
  User_Id: "Missing User_Id",
};

const SubmissionType = new Set(["Image", "Content"]);
const SubmissionStatus = new Set([
  "Approved",
  "Rejected",
  "Pending",
  "Draft",
  "ChangesRequested",
]);

// Util Functions

function validateSubmissionType(type) {
  return SubmissionType.has(type);
}

function validateSubmissionStatus(status) {
  return SubmissionStatus.has(status);
}

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

// Rest Verbs

// Get all submissions on Mysql DB on table submissions paginated
module.exports.getAll = async (event) => {
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
    const [rows] = await connection.execute(
      "SELECT * FROM Submission LIMIT ?, ?",
      [(page - 1) * size, parseInt(size)]
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

// Get submission by id on Mysql DB on table submissions
module.exports.get = async (event) => {
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
    const [rows] = await connection.execute(
      "SELECT * FROM Submission WHERE id = ?",
      [id]
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

// Create submission on Mysql DB on table submissions
module.exports.create = async (event) => {
  const { Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id } =
    JSON.parse(event.body) || null;

  const missingParam = Object.keys(SubmissionCreateRequiredParams).find(
    (param) => !eval(param)
  );

  if (missingParam) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: SubmissionCreateRequiredParams[missingParam],
      }),
    };
  }

  if (!validateSubmissionType(SubmissionType)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid SubmissionType" }),
    };
  }

  if (!validateSubmissionStatus(SubmissionStatus)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid SubmissionStatus" }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    connection.execute(
      "INSERT INTO Submission (Id, Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id) VALUES (UUID(), ?, ?, ?, ?, ?)",
      [Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id]
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Submission created successfully" }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};

// Patch submission on Mysql DB on table submissions
module.exports.patch = async (event) => {
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

    const fieldsNotAllowed = [
      "id",
      "Proeficiency",
      "User_Id",
      "CreatedAt",
      "Reviewers",
    ]; // Fields not allowed for update

    const fieldsToUpdate = {};
    Object.keys(body).forEach((key) => {
      if (!fieldsNotAllowed.includes(key)) {
        fieldsToUpdate[key] = body[key];
      }
    });

    console.log("fieldsToUpdate", fieldsToUpdate);

    const updateQuery = `UPDATE Submission SET ? WHERE Id = ?`;
    const updateParams = [fieldsToUpdate, id];

    connection.execute(updateQuery, updateParams);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Submission updated successfully" }),
    };
  } catch (error) {
    console.error("Error updating submission:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update submission" }),
    };
  }
};
