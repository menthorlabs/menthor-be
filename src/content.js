const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const connectionResolver = require('./database');

// Create a function that goes to AWS S3 and return the size of a list of files
const getFilesSize = async (files) => {
  const s3Client = new S3Client({
    region: process.env.AWS_REG,
  });
  const bucketName = process.env.BUCKET_CONTENT;
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
  const region = process.env.AWS_REG;
  const accessKeyId = process.env.AWS_AKID;
  const secretAccessKey = process.env.AWS_SAK;
  const bucketName = process.env.BUCKET_CONTENT;

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
    return signedUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
};

const deleteFile = async (file) => {
  const s3Client = new S3Client({
    region: process.env.AWS_REG,
  });
  const bucketName = process.env.BUCKET_CONTENT;
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
  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    const images = JSON.parse(rows[0].Images);
    const filesSize = await getFilesSize(images);
    return {
      statusCode: 200,
      body: JSON.stringify({
        images,
        filesSize,
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

module.exports.deleteFile = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { filesName } = JSON.parse(event.body) || null;

  if (!filesName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing filesName parameter' }),
    };
  }

  const connection = await connectionResolver();

  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    const images = JSON.parse(rows[0].Images);
    const newImages = images.filter((image) => !filesName.includes(image));
    const newImagesString = JSON.stringify(newImages);
    const queryUpdate = 'UPDATE ContentCreator SET Images = ? WHERE UserId = ?';
    await connection.query(queryUpdate, [newImagesString, userEmail]);
    await Promise.all(filesName.map((file) => deleteFile(file)));
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Files deleted' }),
    };
  } catch (err) {
    console.error(err);
    return {
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
        statusCode: 400,
        body: JSON.stringify({ error: 'User is not content creator' }),
      };
    }
    const signedUrl = await getSignedUrlPromise(fileType);
    return {
      statusCode: 200,
      body: JSON.stringify({ signedUrl }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};

module.exports.fileUploaded = async (event) => {
  const userEmail = event.requestContext.authorizer.principalId;
  const { fileName } = JSON.parse(event.body) || null;

  if (!fileName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing fileName parameter' }),
    };
  }

  const connection = await connectionResolver();

  try {
    const query = 'SELECT Images FROM ContentCreator WHERE UserId = ?';
    const [rows] = await connection.query(query, [userEmail]);
    const images = JSON.parse(rows[0].Images);
    const newImages = [...images, fileName];
    const newImagesString = JSON.stringify(newImages);
    const queryUpdate = 'UPDATE ContentCreator SET Images = ? WHERE UserId = ?';
    await connection.query(queryUpdate, [newImagesString, userEmail]);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'File uploaded' }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
