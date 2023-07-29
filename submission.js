const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const SubmissionCreateRequiredParams = {
  Content: "Missing Content",
  SubmissionType: "Missing SubmissionType",
  SubmissionStatus: "Missing SubmissionStatus",
  LessonUrl: "Missing LessonUrl",
  Lesson_Id: "Missing Lesson_Id",
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
    const [rows] = await connection.execute(
      "SELECT * FROM Submission WHERE User_Id = ? LIMIT ?, ?",
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

// Get submission by id on Mysql DB on table submissions
module.exports.get = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { submissionId } = event.pathParameters || null;
  if (!submissionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM Submission WHERE Id = ? AND User_Id = ?",
      [submissionId, userEmail]
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
  const userEmail = event.requestContext.authorizer.principalId;
  const body = JSON.parse(event.body);

  const missingParam = Object.keys(CourseCreateRequiredParams).find(
    (param) => body[param] === undefined
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
      "INSERT INTO Submission (Id, Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id, Lesson_Id) VALUES (UUID(), ?, ?, ?, ?, ?, ?)",
      [
        body.Content,
        body.SubmissionType,
        body.SubmissionStatus,
        body.LessonUrl,
        userEmail,
        body.Lesson_Id,
      ]
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
  const userEmail = event.requestContext.authorizer.principalId;
  const { submissionId } = event.pathParameters || null;
  if (!submissionId) {
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

    if (fieldsToUpdate.lessons?.length > 0) {
      fieldsToUpdate.lessons = JSON.stringify(fieldsToUpdate.lessons);
    }

    const updateQuery = `UPDATE Submission SET ${Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ")} WHERE Id = ? AND User_Id = ?`;

    const updateValues = Object.values(fieldsToUpdate);
    updateValues.push(submissionId);
    updateValues.push(userEmail);

    connection.query(updateQuery, updateValues);

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
