module.exports = {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/**/*.test.js", "!**/node_modules/**"],
  testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],
  testPathIgnorePatterns: ["/node_modules/", "/.aws-sam/"],
  verbose: true,
  testTimeout: 10000,
};
