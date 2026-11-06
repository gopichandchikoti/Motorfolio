import { defineConfig } from 'vitest/config';
export default defineConfig({test:{testTimeout:15000,maxWorkers:2,include:['tests/**/*.test.{ts,tsx}'],coverage:{provider:'v8',reporter:['text','json-summary','html'],include:['src/**/*.{ts,tsx}'],thresholds:{lines:90,functions:90,branches:90,statements:90}}},build:{target:'es2022'}});
