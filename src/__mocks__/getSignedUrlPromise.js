const { v4: uuidv4 } = require('uuid');

module.exports.getSignedUrlPromise = jest.fn((ContentType) => {
  const fileName = `${uuidv4()}`;
  const signedUrl = `https://mock-s3-url.com/${fileName}`;

  return Promise.resolve({
    url: signedUrl,
    fileName,
  });
});
