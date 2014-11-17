var gulp = require('gulp');
var webpack = require('gulp-webpack');
var uglify = require('gulp-uglify');
var sass = require('gulp-ruby-sass');
var del = require('del');
var jshint = require('gulp-jshint');
var react = require('gulp-react');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');

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
            filename: "main.js"
        },
        module: {
            loaders: [
                { test: /\.js$/, loader: "jsx-loader" },
                { test: /\.json/, loader: "json-loader"}
            ]
        }
    };
    return conf;
}

gulp.task('lint', function() {
    gulp.src('./js_src/**/*.js')
        .pipe(react())
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
})

gulp.task('js', function() {
    gulp.src('js_src/app.js')
        .pipe(DEV ? sourcemaps.init() : gutil.noop())
        .pipe(webpack(webpack_conf()))
        .pipe(DEV ? sourcemaps.write() : gutil.noop())
        .pipe(DEV ? gutil.noop() : uglify({
                compress: {
                    drop_console: true,
                    global_defs: {PROD: true}
                }
             }))
        .pipe(gulp.dest(target() + 'js/'));
});

gulp.task('css', function() {
    var sassConf = {
        style: DEV ? 'nested' : 'compressed',
        sourcemap: DEV ? 'inline' : 'none'
    };

    gulp.src('sass_src/**/*.scss')
        .pipe(sass(sassConf))
        .pipe(gulp.dest(target() + 'css/'));
});

gulp.task('static', function() {
    gulp.src('static/**').pipe(gulp.dest(target()));
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

gulp.task('build', function() {
    DEV = false;
    gulp.run('clean');
    gulp.run('js', 'css', 'static');
});
