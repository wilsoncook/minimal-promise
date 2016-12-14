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
gulp.task('build', ['clean-build'], function() {
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
	var MinimalPromise = require('./dist/minimal-promise').default, assert = require('assert');
	MinimalPromise.defineGlobalPromise = function() {
		global.Promise = MinimalPromise;
		global.assert = assert;
	};
	MinimalPromise.removeGlobalPromise = function() {
		delete global.Promise;
	};
	testES6(MinimalPromise, function(err) {
		if (err) { return done(err); }
		done();
	});
});

gulp.task('default', ['build']);