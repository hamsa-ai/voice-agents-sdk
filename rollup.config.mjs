import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const commonConfig = {
  input: 'src/main.ts',
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false, // We'll generate declarations separately
      outDir: undefined,
      module: 'esnext',
    }),
    terser({
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    }),
  ],
  external: [], // Bundle all dependencies
};

export default [
  // UMD build
  {
    ...commonConfig,
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'HamsaVoiceAgent',
      exports: 'named',
      sourcemap: true,
    },
  },
  // ESM build
  {
    ...commonConfig,
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
  },
  // CJS build
  {
    ...commonConfig,
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
  },
];
