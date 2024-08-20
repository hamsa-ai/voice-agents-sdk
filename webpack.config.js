const path = require('path');

module.exports = {
    entry: './src/main.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        library: {
            name: 'Hamsa Voice-Agents SDK',
            type: 'umd',  // UMD ensures compatibility across environments
        },
        globalObject: 'this',
        umdNamedDefine: true
    },
    target: 'web',  // 'web' should cover most browser-based environments
    module: {
        rules: [   
            {
                test: /\.worklet\.js/,
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