const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: './src/main.js',  // Your entry point
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        library: {
            type: 'module',  // Universal Module Definition
            export: 'default'
        },
        module: true,
        globalObject: 'this',  // Ensures compatibility with Node.js and browsers
        umdNamedDefine: true
    },
    experiments: {
        outputModule: true  // Enables the use of output.module
    },
    target: ['web', 'es5', 'es6'],    
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 'babel-loader'
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    externals: [nodeExternals()],  // Exclude node_modules from the output bundle
    resolve: {
        extensions: ['.js']
    },
    mode: 'production'
};
