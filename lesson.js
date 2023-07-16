const AWS = require("aws-sdk");
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
  const { lessonId } = event.pathParameters || null;
  if (!lessonId) {
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

// Get lessons done by course id on Mysql DB on table lessons
module.exports.getDoneByCourseId = async (event) => {
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
      "SELECT * FROM Lesson WHERE Course_Id = ? AND User_Id = ? AND Done = 1",
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
  const body = JSON.parse(event.body);

  const missingParam = Object.keys(CourseCreateRequiredParams).find(
    (param) => body[param] === undefined
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
      [
        body.Progress,
        body.TimeTrack,
        body.ContentUrl,
        body.Done,
        body.Course_Id,
        userEmail,
      ]
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
  const { lessonId } = event.pathParameters || null;
  if (!lessonId) {
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
    const updateParams = [fieldsToUpdate, lessonId, userEmail];

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

// Set bool done on lesson on Mysql DB on table lessons, call this.getSignedUrlPromise and return signed url
module.exports.setDone = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { lessonId } = event.pathParameters || null;
  if (!lessonId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing id parameter" }),
    };
  }

  const connection = await connectionResolver();
  // Use the connection
  try {
    const updateQuery = `UPDATE Lesson SET Done = true WHERE Id = ? AND User_Id = ?`;
    const updateParams = [lessonId, userEmail];

    await connection.execute(updateQuery, updateParams);

    const presignedUrlResponse = await module.exports.getSignedUrlPromise();
    const presignedUrl = JSON.parse(presignedUrlResponse.body);

    return {
      statusCode: 200,
      body: JSON.stringify({ presignedUrl }),
    };
  } catch (error) {
    console.error("Error setting lesson as done:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to set lesson as done" }),
    };
  }
};

module.exports.getSignedUrlPromise = async () => {
  const { v4: uuidv4 } = require("uuid");
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.BUCKET_NAME;
  const fileName = uuidv4();

  // Configure AWS SDK
  AWS.config.update({ region, accessKeyId, secretAccessKey });

  const s3 = new AWS.S3();

  const expirationTime = 900; // 15 minutes

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: expirationTime,
    ContentType: "image/jpeg",
    ACL: "private",
  };

  try {
    const presignedUrl = await s3.getSignedUrlPromise("putObject", params);
    return {
      statusCode: 200,
      body: presignedUrl,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error generating presigned URL" }),
    };
  }
};
