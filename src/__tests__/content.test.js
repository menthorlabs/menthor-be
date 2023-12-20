const content = require('../content');

jest.mock('../__mocks__/connectionResolver');
jest.mock('../__mocks__/getSignedUrlPromise');

describe('uploadFile Lambda Function', () => {
  it('should return an error if fileType is missing', async () => {
    const event = {
      body: JSON.stringify({}),
      requestContext: { authorizer: { principalId: 'testUser' } },
    };

    const response = await content.uploadFile(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Missing fileType parameter',
    });
  });
});
