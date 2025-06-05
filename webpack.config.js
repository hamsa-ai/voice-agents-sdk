const path = require('path');

const commonConfig = {
    entry: './src/main.js',
    target: 'web',  // 'web' covers most browser-based environments
    module: {
        rules: [   
            {
                test: /\.worklet\.js$/,
                loader: "audio-worklet-loader",
                options: {
                    inline: "no-fallback",
                }
            },                
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 'babel-loader',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },     
        ]
    },
    resolve: {
        extensions: ['.js'],
        fallback: {
            "events": require.resolve("events/")
        }
    },
    mode: 'production',
    externals: [],  // Define any external dependencies that should not be bundled
};

// UMD Configuration
const umdConfig = {
    ...commonConfig,
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.umd.js',
        library: {
            name: 'HamsaVoiceAgent',
            type: 'umd',
            export: 'default',
        },
        globalObject: 'this',
        umdNamedDefine: true
    },
};

// ESM Configuration
const esmConfig = {
    ...commonConfig,
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.esm.js',
        library: {
            type: 'module',
        },
    },
    experiments: {
        outputModule: true,
    },
    // Ensure that webpack emits ESM-compatible code
    experiments: {
        outputModule: true,
    },
    // If needed, adjust other settings specific to ESM
    externals: {
        // Specify externals as needed for ESM
    },
    // Note: You might need to adjust `package.json` to include `"type": "module"`
};

// CJS Configuration
const cjsConfig = {
    ...commonConfig,
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.cjs.js',
        library: {
            type: 'commonjs2',
        },
    },
    // If needed, adjust settings specific to CJS
    externals: {
        // Specify externals as needed for CJS
    },
};

// Export all configurations as an array
module.exports = [umdConfig, esmConfig, cjsConfig];