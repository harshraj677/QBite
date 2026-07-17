import type { Config } from 'jest';

/**
 * Testing structure (objective 22): unit tests colocated with the
 * file they test (`app-error.test.ts` next to `app-error.ts`);
 * integration tests that spin up the full Express app via Supertest
 * live in `src/tests/integration/`. See docs/CODING_STANDARDS.md §7 —
 * this resolves that doc's "pick one, apply consistently" choice for
 * the backend specifically.
 *
 * `moduleNameMapper` mirrors tsconfig.json's `paths` — Jest doesn't
 * read tsconfig path aliases natively.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1',
    '^@validation/(.*)$': '<rootDir>/src/validation/$1',
    '^@context/(.*)$': '<rootDir>/src/context/$1',
    '^@logging/(.*)$': '<rootDir>/src/logging/$1',
    '^@response/(.*)$': '<rootDir>/src/response/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@health/(.*)$': '<rootDir>/src/health/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/server.ts'],
  clearMocks: true,
};

export default config;
