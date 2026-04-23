export default {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/tests/**/*.test.js'],
      testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testTimeout: 30000,
    },
  ],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: ['src/**/*.js'],
};
