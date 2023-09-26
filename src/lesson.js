const connectionResolver = require('./database');

const LessonCreateRequiredParams = {
  Progress: 'Missing Progress',
  TimeTrack: 'Missing TimeTrack',
  ContentUrl: 'Missing ContentUrl',
  Done: 'Missing Done',
  Course_Id: 'Missing Course_Id',
};

// Get all lessons on Mysql DB on table lessons paginated
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
    const [rows] = await connection.query(
      'SELECT * FROM Lesson WHERE User_Id = ? LIMIT ?, ?',
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

// Get lesson by id on Mysql DB on table lessons
module.exports.get = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { lessonId } = event.pathParameters || null;
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
    const [rows] = await connection.query(
      'SELECT * FROM Lesson WHERE Id = ? AND User_Id = ?',
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

// Get lessons done by course id on Mysql DB on table lessons
module.exports.getDoneByCourseId = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { id } = event.pathParameters || null;
  if (!id) {
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
    const [rows] = await connection.query(
      'SELECT * FROM Lesson WHERE Course_Id = ? AND User_Id = ? AND Done = 1',
      [id, userEmail],
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

// Create lesson on Mysql DB on table lessons
module.exports.create = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const body = JSON.parse(event.body);

  const missingParam = Object.keys(LessonCreateRequiredParams).find(
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
        error: LessonCreateRequiredParams[missingParam],
      }),
    };
  }

  const connection = await connectionResolver();

  // Use the connection
  try {
    const [rows] = await connection.query(
      'INSERT INTO Lesson (Progress, TimeTrack, ContentUrl, Done, Course_Id, User_Id) VALUES (?, ?, ?, ?, ?, ?)',
      [
        body.Progress,
        body.TimeTrack,
        body.ContentUrl,
        body.Done,
        body.Course_Id,
        userEmail,
      ],
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

// Update lesson on Mysql DB on table lessons
module.exports.patch = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { lessonId } = event.pathParameters || null;
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
    const body = JSON.parse(event.body);

    const fieldsNotAllowed = ['Id', 'User_Id', 'Course_Id']; // Fields not allowed for update

    const fieldsToUpdate = {};
    Object.keys(body).forEach((key) => {
      if (!fieldsNotAllowed.includes(key)) {
        fieldsToUpdate[key] = body[key];
      }
    });

    const updateQuery = 'UPDATE Lesson SET ? WHERE Id = ? AND User_Id = ?';
    const updateParams = [fieldsToUpdate, lessonId, userEmail];

    connection.execute(updateQuery, updateParams);

    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({ message: 'Lesson updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating lesson:', error);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update lesson' }),
    };
  }
};
