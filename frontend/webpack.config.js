module.exports = {
    entry: "./js_src/app.js",
    output: {
        filename: "app/js/main.js"
    },
    module: {
        loaders: [
            { test: /\.react.js$/, loader: "jsx-loader" },
            { test: /\.json/, loader: "json-loader"}
        ]
    }
};
