var gulp = require('gulp');
var webpack = require('gulp-webpack');
var uglify = require('gulp-uglify');
var sass = require('gulp-ruby-sass');
var del = require('del');
var jshint = require('gulp-jshint');
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

var DEV = false;

function target() {
    if (DEV) {
        return './_build/dev/';
    } else {
        return './_build/prod/';
    }
}

function webpack_conf() {
    var conf = {
        output: {
            filename: "main.js",
            publicPath: "/js/"
        },
        module: {
            loaders: [
                { test: /\.js$/, loader: "jsx-loader" },
                { test: /\.json/, loader: "json-loader"}
            ],
            postLoaders: [
                { test: /\.js$/, loader: "regenerator" }
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
    return gulp.src('./js_src/**/*.js')
        .pipe(react())
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
})

gulp.task('js', function() {
    var filter = gulpFilter(['main.js']);
    return gulp.src('js_src/app.js')
        .pipe(webpack(webpack_conf()))
        .pipe(DEV ? insert.prepend('const PROD=false;\n') : gutil.noop())
        .pipe(DEV ? gutil.noop() : uglify({
                mangle: {
                    except: ['GeneratorFunction']
                },
                compress: {
                    drop_console: true,
                    global_defs: {PROD: true}
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

gulp.task('build', function() {
    DEV = false;
    gulp.run('rev-static');
});
