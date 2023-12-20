const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const connectionResolver = require('./database');

const region = process.env.AWS_REG;
const accessKeyId = process.env.AWS_AKID;
const secretAccessKey = process.env.AWS_SAK;
const bucketName = process.env.BUCKET_CONTENT;
const { DISCORD_WEBHOOK_URL } = process.env;

// Create a function that goes to AWS S3 and return the size of a list of files
const getFilesSize = async (files) => {
  const clientParams = {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
  };
  const s3Client = new S3Client(clientParams);
  const filesSize = await Promise.all(
    files.map(async (file) => {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: file,
      });
      const { ContentLength } = await s3Client.send(command);
      return ContentLength;
    }),
  );
  return filesSize.reduce((acc, cur) => acc + cur, 0);
};

const getSignedUrlPromise = async (ContentType) => {
  const fileName = `${uuidv4()}`;

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

const deleteFile = async (file) => {
  const clientParams = {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
  };
  const s3Client = new S3Client(clientParams);
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: file,
  });
  try {
    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};

// ## Routes
module.exports.returnAllFileLinks = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;

  const connection = await connectionResolver();
  let images;
  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    if (rows.length === 0) {
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 200,
        body: JSON.stringify([]),
      };
    }

    images = rows[0].Images;
    const filesSize = await getFilesSize(images);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({
        images,
        filesSize,
      }),
    };
  } catch (err) {
    if (images) {
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 200,
        body: JSON.stringify({
          images,
          filesSize: 0,
        }),
      };
    }
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

module.exports.webhook = async (event) => {
  try {
    const body = JSON.parse(event.body); // Parse the event body

    // Prepare the message content
    const message = {
      content: 'New Event Received:',
      embeds: [
        {
          title: 'Event Details',
          description: `\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\``,
          color: 5814783,
        },
      ],
    };

    // Send the message using Discord webhook
    await axios.post(DISCORD_WEBHOOK_URL, message);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event processed and sent to Discord.' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process event.' }),
    };
  }
};

module.exports.deleteFile = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const fileId = event.pathParameters.id;

  const connection = await connectionResolver();

  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    const images = JSON.parse(rows[0].Images);
    const newImages = images.filter((image) => image !== fileId);
    const newImagesString = JSON.stringify(newImages);
    const queryUpdate = 'UPDATE ContentCreator SET Images = ? WHERE UserId = ?';
    await connection.query(queryUpdate, [newImagesString, userEmail]);
    await deleteFile(fileId);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({ message: 'File deleted' }),
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

module.exports.uploadFile = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { fileType } = JSON.parse(event.body) || null;

  if (!fileType) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing fileType parameter' }),
    };
  }
  const connection = await connectionResolver();
  try {
    const query = 'SELECT * FROM User WHERE IsContentCreator = ? AND Email = ?';
    const [rows] = await connection.query(query, [true, userEmail]);
    if (rows.length === 0) {
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 400,
        body: JSON.stringify({ error: 'User is not content creator' }),
      };
    }
    const signedUrl = await getSignedUrlPromise(fileType);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 200,
      body: JSON.stringify({ signedUrl }),
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

module.exports.fileUploaded = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { url } = JSON.parse(event.body) || null;

  if (!url) {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing url parameter' }),
    };
  }

  const connection = await connectionResolver();

  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    if (
      rows.length === 0 ||
      rows[0].Images === null ||
      rows[0].Images === 'null'
    ) {
      const newImages = [url];
      const newImagesString = JSON.stringify(newImages);
      const queryUpdate =
        'INSERT INTO ContentCreator (Id, UserId, Images) VALUES (UUID(), ?, ?)';
      await connection.query(queryUpdate, [userEmail, newImagesString]);
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        statusCode: 204,
      };
    }
    const images = rows[0].Images;
    const newImages = [...images, url];
    const newImagesString = JSON.stringify(newImages);
    const queryUpdate = 'UPDATE ContentCreator SET Images = ? WHERE UserId = ?';
    await connection.query(queryUpdate, [newImagesString, userEmail]);
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: 204,
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
