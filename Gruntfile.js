module.exports = function(grunt) {
    
    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
        browserify: {
            sample: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                files: {
                    'build/sample.min.js': [
                        'src/blueRouter.js', 
                        'src/router.js', 
                        'src/defaultOptions.js',
                        'src/htmlFetcher.js',
                        'src/utils.js',
                        'samples/sample.js'
                    ]
                },
            }
        },
        qunit: {
            browser: {
                options: {
                    timeout: 60000,
                    urls: [
                        'http://localhost:9000/test/blueRouter-core.html'
                    ]
                }
            }
        },
        compress: {
            main: {
                options: {
                    archive: 'dist/<%= pkg.name %>-js_<%= grunt.template.today("yyyy-mm-dd_HHMM") %>.tar.gz',
                    pretty: true
                },
                expand: true,
                files: [
                    {
                        cwd: 'docs/',
                        expand: true,
                        src: ['**/*', '!**/*~'],
                        dest: 'docs'
                    },
                    {
                        cwd: 'externs/',
                        expand: true,
                        src: ['**/*', '!**/*~'],
                        dest: 'externs'
                    },
                    {
                        cwd: 'samples/',
                        expand: true,
                        src: ['**/*', '!**/*~'],
                        dest: 'samples'
                    },
                    {
                        cwd: 'src/',
                        expand: true,
                        src: ['**/*', '!**/*~'],
                        dest: 'src'
                    },
                    {
                        cwd: 'test/',
                        expand: true,
                        src: ['**/*', '!**/*~'],
                        dest: 'test'
                    }, 
                    {
                        src: ['changes.txt']
                    },
                    {
                        src: ['Gruntfile.js']
                    }, 
                    {
                        src: ['LICENSE']
                    },
                    {
                        src: ['package.json']
                    },
                    {
                        src: ['package-lock.json']
                    },
                    {
                        src: ['README.md']
                    }
                ]
            },
            'blueRouter-core': {
                options: {
                    archive: 'build/blueRouter-core.min.js.tar.gz'
                },
                files: [
                    {
                        src: [ 'build/blueRouter-core.min.js' ]
                    }
                ]
            }
        },
        concat: {
            options: {
                stripBanners: true,
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd HH:M:s") %> */\n'
            },
            standalone: {
                src: [
                    'src/blueRouter.js', 
                    'src/router.js', 
                    'src/defaultOptions.js',
                    'src/htmlFetcher.js',
                    'src/utils.js',
                    'src/export.js'
                ],
                dest: 'build/blueRouter.standalone.concat.js',
                nonull: true
            }
        },
        uglify: {
            standalone: {
                files: {
                    'build/blueRouter.standalone.concat.min.js': [ 'build/blueRouter.standalone.concat.js' ]
                }
            }
        },
        copy: {
            srcToBuild: {
                src: 'src/*',
                dest: 'build/'
            },
            sampleToBuild: {
                src: 'samples/*.js',
                dest: 'build/'
            },
        },
        'closure-compiler': {
            sample: {
                options: {
                    js: [
                        'src/blueRouter.js', 
                        'src/router.js', 
                        'src/defaultOptions.js',
                        'src/htmlFetcher.js',
                        'src/utils.js',
                        'samples/sample.js'
                    ],
                    js_output_file: 'build/sample.gcc.js',
                    compilation_level: 'ADVANCED',
                    create_source_map: 'build/sample.gcc.js.map',
                    warning_level: 'VERBOSE',
                    output_wrapper: '(function(){\n%output%\n}).call(this)\n//# sourceMappingURL=sample.gcc.js.map',
                    debug: true
                }
            }
        },
        shell: {
            // Create symlinks in build directory so we don't need to do anything when updating files in that folders
            // and  we want to see the samples.html page
            createSymlinks: {
                command: 'ln -s ../src build; ln -s ../samples build'
            }
        },
        exec: {
            check_node: 'node samples/src/app/node.js'
        }
    });

    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-browserify')
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-shell');

    require('google-closure-compiler').grunt(grunt, {
        platform: ['native', 'java', 'javascript'],
        max_parallel_compilations: require('os').cpus().length
    });
    // The load-grunt-tasks plugin won’t automatically load closure-compiler

    grunt.registerTask('test', ['qunit']);
    grunt.registerTask('default', [
        'closure-compiler:sample',
        'concat:standalone',
        'uglify:standalone'
    ]);
    grunt.registerTask('all', ['default', 'buildTests', 'test']);
};
