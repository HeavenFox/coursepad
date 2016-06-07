var gulp = require('gulp');
var babel = require('gulp-babel');
var webpack = require('webpack');
var webpackStream = require('webpack-stream');
var uglify = require('gulp-uglify');
var sass = require('gulp-sass');
var del = require('del');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');
var replace = require('gulp-replace');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer-core');
var rev = require('gulp-rev');
var revCollector = require('gulp-rev-collector');
var minifyHTML   = require('gulp-minify-html');
var gulpFilter = require('gulp-filter');

var KarmaServer = require('karma').Server;

var LEVEL = +process.env.LEVEL;
if (!LEVEL) LEVEL = 1;

var DEV = LEVEL == 1;

function target() {
    if (DEV) {
        return './_build/dev/';
    } else {
        return './_build/prod/';
    }
}

function webpack_conf() {
    var babel_query = {
        optional: ['runtime'],
        stage: 1
    };

    if (DEV) {
        // Target chrome
        babel_query = {
            optional: ['runtime', 'asyncToGenerator'],
            blacklist: ['es6.constants', 'es6.blockScoping', 'es6.arrowFunctions'],
        }
    };
    var conf = {
        output: {
            filename: "main.js",
            publicPath: "/js/"
        },
        module: {
            loaders: [
                {test: /\.tsx?$/, loaders: ['babel?' + JSON.stringify(babel_query), 'ts-loader']},
                {test: /\.js$/, exclude: /node_modules/, loader: "babel", query: babel_query},
            ]
        },
        ts: {
            configFileName: 'tsconfig.webpack.json'
        },
        resolve: {
            extensions: ['', '.ts', '.tsx', '.js']
        },
        plugins: [
            new webpack.DefinePlugin({
                LEVEL: JSON.stringify(LEVEL)
            })
        ]
    };
    return conf;
}

function prod(t) {
    if (DEV) {
        return gutil.noop();
    }
    return t;
}

function dev(t) {
    if (DEV) {
        return t;
    }
    return gutil.noop();
}

gulp.task('js', function() {
    var filter = gulpFilter(['main.js']);
    return gulp.src('js_src/app.tsx')
        .pipe(webpackStream(webpack_conf()))
        .on('error', gutil.log)
        .pipe((LEVEL <= 7) ? gutil.noop() : uglify({
                mangle: {
                    except: ['GeneratorFunction']
                },
                compress: {
                    drop_console: true
                }
             }))
        .pipe(prod(filter))
            .pipe(prod(rev()))
        .pipe(prod(filter.restore()))

        .pipe(gulp.dest(target() + 'js/'))
        .pipe(prod(rev.manifest()))
        .pipe(prod(gulp.dest( '/tmp/rev/js' )));
});

gulp.task('css', function() {
    var sassConf = {
        style: DEV ? 'nested' : 'compressed',
        sourcemap: DEV ? true : false
    };

    return gulp.src('sass_src/**/*.scss')
        .pipe(sass(sassConf).on('error', sass.logError))
        .pipe(postcss([autoprefixer({})]))
        .pipe(prod(rev()))
        .pipe(gulp.dest(target() + 'css/'))
        .pipe( prod(rev.manifest()) )
        .pipe( prod(gulp.dest( '/tmp/rev/css' )) );
});

gulp.task('static', function() {
    var filter = gulpFilter(['index.html'], {restore: true});
    return gulp.src('static/**')
               .pipe(dev(filter))
               .pipe(dev(replace('react.min.js', 'react.js')))
               .pipe(dev(replace('react-dom.min.js', 'react-dom.js')))
               .pipe(dev(filter.restore()))
               .pipe(gulp.dest(target()));
});

gulp.task('default', function() {
    DEV = true;
    gulp.run('js', 'css', 'static');

    gulp.watch('js_src/**/*', ['js']);
    gulp.watch('sass_src/**/*.scss', ['css']);
    gulp.watch('static/**', ['static']);
});

gulp.task('clean', function() {
    del(['_build/prod/**']);
});

gulp.task('rev-index', ['js', 'css', 'static'], function() {
    return gulp.src(['/tmp/rev/**/*.json', target() + 'index.html'])
        .pipe(revCollector({
            replaceReved: true
        }))
        .pipe(gulp.dest(target()))
});

gulp.task('rev-static', ['rev-index'], function() {
    return gulp.src(['/tmp/rev/**/*.json', target() + 'static/*.html'])
        .pipe(revCollector({
            replaceReved: true
        }))
        .pipe(gulp.dest(target() + 'static/'))
});

gulp.task('build', ['rev-static']);

gulp.task('test', function(done) {
    var webpackConfig = webpack_conf();
    delete webpackConfig['output'];

    new KarmaServer({
        files: ['js_src/**/tests/*.ts'],
        frameworks: ['mocha'],
        preprocessors: {'js_src/**/tests/*.ts': ['webpack']},
        reporters: ['progress'],
        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'],

        webpack: webpackConfig,
        webpackMiddleware: {
            // webpack-dev-middleware configuration
            // i. e.
            noInfo: true
        },
        plugins: [
            'karma-webpack',
            'karma-mocha',
            'karma-chrome-launcher'
        ],
        singleRun: true
    }, done).start();
});