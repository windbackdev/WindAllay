import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/index.tsx',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'index.js',
    chunkFileNames: '[name]-[hash].js',
  },
  platform: 'node',
  resolve: {
    tsconfigFilename: 'tsconfig.json',
  },
  cleanDir: true,
});


