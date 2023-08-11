const mysql = require("mysql2/promise");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const SubmissionCreateRequiredParams = {
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
  "Done",
  "ChangesRequested",
]);

// Util Functions

const getSignedUrlPromise = async () => {
  const { v4: uuidv4 } = require("uuid");
  const fileName = `${uuidv4()}.jpg`;
  const region = process.env.AWS_REG;
  const accessKeyId = process.env.AWS_AKID;
  const secretAccessKey = process.env.AWS_SAK;
  const bucketName = process.env.BUCKET_NAME;

  const clientParams = {
    region,
    accessKeyId,
    secretAccessKey,
  };
  const putObjectParams = {
    Bucket: bucketName,
    Key: fileName,
    ContentType: "image/jpeg",
    ACL: "public-read",
  };

  try {
    const client = new S3Client(clientParams);
    const command = new PutObjectCommand(putObjectParams);
    const url = await getSignedUrl(client, command, { expiresIn: 900 });
    return {
      url,
      fileName,
    };
  } catch (e) {
    console.error(e);
  }
};

const searchFileAndDelete = async (path) => {
  const clientParams = {
    region: process.env.AWS_REG,
    accessKeyId: process.env.AWS_AKID,
    secretAccessKey: process.env.AWS_SAK,
  };
  const bucketName = process.env.BUCKET_NAME;
  const client = new S3Client(clientParams);
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: path,
  });
  try {
    await client.send(command);
  } catch (e) {
    console.error(e);
  }
};

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

const checkSubmissionLimit = async (userId, lessonId) => {
  const connection = await connectionResolver();
  const [rows] = await connection.query(
    "SELECT COUNT(*) FROM Submission WHERE User_Id = ? AND Lesson_Id = ?",
    [userId, lessonId]
  );
  console.log(rows);
  return rows[0]["count(*)"] >= 5;
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
  const { submissionId: lessonId } = event.pathParameters || null;
  if (!lessonId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM Submission WHERE Lesson_Id = ? AND User_Id = ?",
      [lessonId, userEmail]
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

  const missingParam = Object.keys(SubmissionCreateRequiredParams).find(
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

  if (!validateSubmissionType(body.SubmissionType)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid SubmissionType" }),
    };
  }

  if (!validateSubmissionStatus(body.SubmissionStatus)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid SubmissionStatus" }),
    };
  }

  const isUnderSubmissionLimit = await checkSubmissionLimit(
    userEmail,
    body.Lesson_Id
  );

  if (isUnderSubmissionLimit) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Submission limit reached" }),
    };
  }

  const connection = await connectionResolver();
  const { v4: uuidv4 } = require("uuid");
  const id = uuidv4();

  // Use the connection
  try {
    connection.query(
      "INSERT INTO Submission (Id, Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id, Lesson_Id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        body.Content || null,
        body.SubmissionType,
        body.SubmissionStatus,
        body.LessonUrl,
        userEmail,
        body.Lesson_Id,
      ]
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Submission created successfully",
        submissionId: id,
      }),
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
      "Filename",
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

module.exports.requestSubmissionUrl = async (event) => {
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
      "SELECT * FROM Submission WHERE Id = ? AND User_Id = ? and SubmissionStatus = 'PENDING' and SubmissionType = 'Image'",
      [submissionId, userEmail]
    );

    if (rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Submission not found" }),
      };
    }

    const submission = rows[0];

    if (submission.Filename !== null) {
      try {
        searchFileAndDelete(submission.Filename);
      } catch (error) {
        console.error("File not found, skipping", error);
      }
    }

    const url = await getSignedUrlPromise();

    connection.query("UPDATE Submission SET Filename = ? WHERE Id = ?", [
      url.fileName,
      submissionId,
      userEmail,
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Submission url generated successfully",
        url: url,
      }),
    };
  } catch (error) {
    console.error("Error generating submission url:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate submission url" }),
    };
  }
};
