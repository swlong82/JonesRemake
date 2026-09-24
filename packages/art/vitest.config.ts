import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'art',
    include: ['src/**/*.test.ts'],
    // The sanitizer walks a parsed DOM; jsdom supplies `DOMParser` the way the browser does.
    environment: 'jsdom',
  },
});
