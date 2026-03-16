/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@metro-nomedeul/shared$': '<rootDir>/../../packages/shared/src/index',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
