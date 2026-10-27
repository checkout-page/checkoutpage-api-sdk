module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.test.js'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/live/'],
    },
    {
      displayName: 'live',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/live/**/*.test.js'],
    },
  ],
};
