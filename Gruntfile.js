/*jslint browser: true*/
/*global $, jQuery, BBBX, test, module, ok, widget, sinon, require*/
module.exports = function (grunt) {

	'use strict';

	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		watch:	{
			jshint: {
				files: ['src/**/*.js'],
				tasks: ['jshint']
			},
			requirejs: {
				files: ['src/**/*.js', '!src/wingman.min.js', 'requirejs.config.js'],
				tasks: ['requirejs:compile']
			}
		},

		jshint: {
			all: [
				'Gruntfile.js',
				'requirejs.config.js',
				'src/**/*.js',
				'!src/wingman.min.js'
			],
			options: grunt.file.readJSON('.jshintrc')
		},

		requirejs: {
			options: grunt.file.readJSON('requirejs.config.js'),
			compile: {
				options: {
					optimize: 'none',
					out: 'dist/wingman.js'
				}
			},
			minify: {
				options: {
					optimize: 'uglify',
					out: 'dist/wingman.min.js'
				}
			}
		}
	});

	grunt.registerTask('release', [
		'jshint',
		'requirejs'
	]);

};
