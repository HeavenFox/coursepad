#!/bin/sh

# run sass preprocessor
sass --watch sass_src:app/css &

# run webpack
node_modules/.bin/webpack --devtool inline-source-map --watch &

trap "kill 0" SIGINT SIGTERM EXIT

echo "Dev environment ready"

wait
