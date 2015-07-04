var gulp = require('gulp');
var babel = require('gulp-babel');
var webpack = require('webpack-stream');
var uglify = require('gulp-uglify');
var sass = require('gulp-ruby-sass');
var del = require('del');
var jshint = require('gulp-jshint');
var eslint = require('gulp-eslint');
var insert = require('gulp-insert');
var react = require('gulp-react');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer-core');
var rev = require('gulp-rev');
var revCollector = require('gulp-rev-collector');
var minifyHTML   = require('gulp-minify-html');
var gulpFilter = require('gulp-filter');

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
            blacklist: ['es6.constants', 'es6.classes', 'es6.blockScoping'],
        }
    };
    var conf = {
        output: {
            filename: "main.js",
            publicPath: "/js/"
        },
        module: {
            loaders: [
                { test: /\.js$/, exclude: /node_modules/, loader: "babel", query: babel_query},
                { test: /\.json/, loader: "json-loader"}
            ]
        }
    };
    return conf;
}

function prod(t) {
    if (DEV) {
        return gutil.noop();
    }
    return t;
}

gulp.task('lint', function() {
    var eslint_setting = {
        "ecmaFeatures": {
            "blockBindings": true,
            "generators": true,
            "forOf": true,
            "jsx": true
        },
        envs: [
            'browser',
            'es6'
        ],
        "globals": {
                "React": false,
                'require': false,
                'exports': false,
                'module': false,
                '$': false,
                'LEVEL': false,
            },
        "rules": {
            'quotes': 0,
            'global-strict': 0,
            'dot-notation': 0,
            'no-underscore-dangle': 0,
        },

    };

    return gulp.src('./js_src/**/*.js')
        .pipe(babel({
        optional: ['runtime', 'asyncToGenerator']
        }))
        .pipe(eslint(eslint_setting))
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
})

gulp.task('js', function() {
    var filter = gulpFilter(['main.js']);
    return gulp.src('js_src/app.js')
        .pipe(webpack(webpack_conf()))
        .pipe(DEV ? insert.prepend('const LEVEL=' + LEVEL + ';\n') : gutil.noop())
        .pipe(DEV ? gutil.noop() : uglify({
                mangle: {
                    except: ['GeneratorFunction']
                },
                compress: {
                    drop_console: true,
                    global_defs: {'LEVEL': LEVEL}
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
        sourcemap: DEV ? 'none' : 'none'
    };

    return gulp.src('sass_src/**/*.scss')
        .pipe(sass(sassConf))
        .pipe(postcss([autoprefixer({})]))
        .pipe(prod(rev()))
        .pipe(gulp.dest(target() + 'css/'))
        .pipe( prod(rev.manifest()) )
        .pipe( prod(gulp.dest( '/tmp/rev/css' )) );
});

gulp.task('static', function() {
    return gulp.src('static/**').pipe(gulp.dest(target()));
});

gulp.task('default', function() {
    DEV = true;
    gulp.run('js', 'css', 'static');

    gulp.watch('js_src/**/*.js', ['js']);
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
