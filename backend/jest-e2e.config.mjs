import { base } from './jest.config.mjs';

/** @type {import('jest').Config} */
export default {
  ...base,
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  setupFiles: [...base.setupFiles, '<rootDir>/test/setup-env.ts'],
  testTimeout: 30000,
};
