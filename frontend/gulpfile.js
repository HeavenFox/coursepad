var gulp = require('gulp');
var webpack = require('gulp-webpack');
var uglify = require('gulp-uglify');
var sass = require('gulp-ruby-sass');
var insert = require('gulp-insert');
var del = require('del');

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

gulp.task('js', function() {
    var c = gulp.src('js_src/app.js')
                .pipe(webpack(webpack_conf()));

    if (!DEV) {
        c = c.pipe(insert.prepend('const PROD=true;\n'))
             .pipe(uglify({
                compress: {
                    drop_console: true
                }
             }));
    } else {
        c = c.pipe(insert.prepend('const PROD=false;\n'));
    }
    c.pipe(gulp.dest(target() + 'js/'));
});

gulp.task('css', function() {
    var sassConf = {
        style: DEV ? 'nested' : 'compressed'
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
