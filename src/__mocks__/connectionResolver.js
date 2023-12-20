module.exports = jest.fn(() => {
  const mockConnection = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    state: 'connected',
  };

  mockConnection.query.mockImplementation((sql, values) => Promise.resolve([]));

  return Promise.resolve(mockConnection);
});
