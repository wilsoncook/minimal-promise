var gulp = require('gulp');
var mocha = require('gulp-mocha');
var ts = require('gulp-typescript');
var clean = require('gulp-clean');
var tsProject = ts.createProject('tsconfig.json');
var testES6 = require('promises-es6-tests');

//clear the dist folder
gulp.task('clean-build', function() {
	return gulp.src('dist', { read: false })
		.pipe(clean());
});

//tranlate all *.ts into *.js under dist
gulp.task('build', function() {
	return tsProject.src()
		.pipe(tsProject())
		.js.pipe(gulp.dest('dist'));
});

//run test cases

// gulp.task('test', ['build'], function() {
// 	return gulp.src('dist/tests/**/*.js')
// 		.pipe(mocha());
// });

gulp.task('test-es6', ['build'], function(done) {
	var MiniPromise = require('./dist/mini-promise').default, assert = require('assert');
	MiniPromise.defineGlobalPromise = function() {
		global.Promise = MiniPromise;
		global.assert = assert;
	};
	MiniPromise.removeGlobalPromise = function() {
		delete global.Promise;
	};
	testES6(MiniPromise, function(err) {
		if (err) { return done(err); }
		done();
	});
});

gulp.task('default', ['build']);