const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const connectionResolver = require('./database');

const SubmissionCreateRequiredParams = {
  SubmissionType: 'Missing SubmissionType',
  SubmissionStatus: 'Missing SubmissionStatus',
  LessonUrl: 'Missing LessonUrl',
  Lesson_Id: 'Missing Lesson_Id',
};

const SubmissionType = new Set(['Image', 'Content']);
const SubmissionStatus = new Set([
  'Approved',
  'Rejected',
  'Pending',
  'Draft',
  'Done',
  'ChangesRequested',
]);

// Util Functions

const getSignedUrlPromise = async (ContentType) => {
  const fileName = `${uuidv4()}`;
  const region = process.env.AWS_REG;
  const accessKeyId = process.env.AWS_AKID;
  const secretAccessKey = process.env.AWS_SAK;
  const bucketName = process.env.BUCKET_NAME;

  const clientParams = {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
  };
  const putObjectParams = {
    Bucket: bucketName,
    Key: fileName,
    ContentType,
    ACL: 'public-read',
  };

  const s3Client = new S3Client(clientParams);
  const command = new PutObjectCommand(putObjectParams);

  try {
    await s3Client.send(command);
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });
    return {
      url: signedUrl,
      fileName,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
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

const checkSubmissionLimit = async (userId, lessonId) => {
  const connection = await connectionResolver();
  const [rows] = await connection.query(
    'SELECT COUNT(*) FROM Submission WHERE User_Id = ? AND Lesson_Id = ?',
    [userId, lessonId],
  );
  return rows[0]['count(*)'] >= 5;
};

// Rest Verbs

// Get all submissions on Mysql DB on table submissions paginated
module.exports.getAll = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  let { page = 1, size = 10 } = event.queryStringParameters || {
    page: 1,
    size: 10,
  };

  page = parseInt(page, 10);
  size = parseInt(size, 10);

  size = size > 20 ? 20 : size;

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM Submission WHERE User_Id = ? LIMIT ?, ?',
      [userEmail, (page - 1) * size, parseInt(size, 10)],
    );
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing id parameter' }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM Submission WHERE Lesson_Id = ? AND User_Id = ?',
      [lessonId, userEmail],
    );
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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
    (param) => body[param] === undefined,
  );

  if (missingParam) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({
        error: SubmissionCreateRequiredParams[missingParam],
      }),
    };
  }

  if (!validateSubmissionType(body.SubmissionType)) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid SubmissionType' }),
    };
  }

  if (!validateSubmissionStatus(body.SubmissionStatus)) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid SubmissionStatus' }),
    };
  }

  const isUnderSubmissionLimit = await checkSubmissionLimit(
    userEmail,
    body.Lesson_Id,
  );

  if (isUnderSubmissionLimit) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Submission limit reached' }),
    };
  }

  const connection = await connectionResolver();
  const id = uuidv4();

  // Use the connection
  try {
    connection.query(
      'INSERT INTO Submission (Id, Content, SubmissionType, SubmissionStatus, LessonUrl, User_Id, Lesson_Id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        body.Content || null,
        body.SubmissionType,
        body.SubmissionStatus,
        body.LessonUrl,
        userEmail,
        body.Lesson_Id,
      ],
    );
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({
        message: 'Submission created successfully',
        submissionId: id,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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
      body: JSON.stringify({ error: 'Missing id parameter' }),
    };
  }

  const connection = await connectionResolver();
  // Use the connection
  try {
    const body = JSON.parse(event.body);

    const fieldsNotAllowed = [
      'id',
      'Proeficiency',
      'Filename',
      'User_Id',
      'CreatedAt',
      'Reviewers',
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
      .join(', ')} WHERE Id = ? AND User_Id = ?`;

    const updateValues = Object.values(fieldsToUpdate);
    updateValues.push(submissionId);
    updateValues.push(userEmail);

    connection.query(updateQuery, updateValues);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Submission updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating submission:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Failed to update submission' }),
    };
  }
};

module.exports.requestSubmissionUrl = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { submissionId } = event.pathParameters || null;
  const body = JSON.parse(event.body);

  const ContentType = body.contentType || 'image/jpeg';

  if (!submissionId) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing id parameter' }),
    };
  }

  const connection = await connectionResolver();
  // Use the connection
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM Submission WHERE Id = ? AND User_Id = ? and SubmissionStatus = 'PENDING' and SubmissionType = 'Image'",
      [submissionId, userEmail],
    );

    if (rows.length === 0) {
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 404,
        body: JSON.stringify({ error: 'Submission not found' }),
      };
    }

    const submission = rows[0];

    if (submission.Filename !== null) {
      try {
        searchFileAndDelete(submission.Filename);
      } catch (error) {
        console.error('File not found, skipping', error);
      }
    }

    const signedUrl = await getSignedUrlPromise(ContentType);

    connection.query('UPDATE Submission SET Filename = ? WHERE Id = ?', [
      signedUrl.fileName,
      submissionId,
      userEmail,
    ]);

    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({
        message: 'Submission url generated successfully',
        url: signedUrl.url,
        fileName: signedUrl.fileName,
      }),
    };
  } catch (error) {
    console.error('Error generating submission url:', error);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate submission url' }),
    };
  }
};
