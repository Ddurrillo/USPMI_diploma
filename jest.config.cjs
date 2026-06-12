/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/client'],
  setupFilesAfterEnv: ['<rootDir>/client/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
          noImplicitAny: false,
          types: ['jest', 'node', '@testing-library/jest-dom']
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', 'utils.spec.ts'],
  globals: {
    __API_BASE__: '""', // В тестах база будет пустой строкой
  },
};