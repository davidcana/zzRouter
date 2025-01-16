module.exports = function(grunt) {
    
    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
        browserify: {
            noTransitionNavigation: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/noTransitionNavigation.js',
                dest: 'build/js/noTransitionNavigation.js'
            },
            noTransitionEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/noTransitionEvents.js',
                dest: 'build/js/noTransitionEvents.js'
            },
            noTransitionRender: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/noTransitionRender.js',
                dest: 'build/js/noTransitionRender.js'
            },
            bothTransitionNavigation: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/bothTransitionNavigation.js',
                dest: 'build/js/bothTransitionNavigation.js'
            },
            inTransitionNavigation: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/inTransitionNavigation.js',
                dest: 'build/js/inTransitionNavigation.js'
            },
            outTransitionNavigation: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/outTransitionNavigation.js',
                dest: 'build/js/outTransitionNavigation.js'
            },
            bothTransitionEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/bothTransitionEvents.js',
                dest: 'build/js/bothTransitionEvents.js'
            },
            inTransitionEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/inTransitionEvents.js',
                dest: 'build/js/inTransitionEvents.js'
            },
            outTransitionEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/outTransitionEvents.js',
                dest: 'build/js/outTransitionEvents.js'
            },
            bothTransitionRender: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/bothTransitionRender.js',
                dest: 'build/js/bothTransitionRender.js'
            },
            inTransitionRender: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/inTransitionRender.js',
                dest: 'build/js/inTransitionRender.js'
            },
            outTransitionRender: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/outTransitionRender.js',
                dest: 'build/js/outTransitionRender.js'
            },
            bothTransitionLazyUrlEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/bothTransitionLazyUrlEvents.js',
                dest: 'build/js/bothTransitionLazyUrlEvents.js'
            },
            bothTransitionPreloadUrlEvents: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                src: 'test/js/bothTransitionPreloadUrlEvents.js',
                dest: 'build/js/bothTransitionPreloadUrlEvents.js'
            }
        },
        qunit: {
            browser: {
                options: {
                    timeout: 300000,
                    urls: [
                        'http://localhost:9000/test/noTransitionNavigation.html',
                        'http://localhost:9000/test/bothTransitionNavigation.html',
                        'http://localhost:9000/test/inTransitionNavigation.html',
                        'http://localhost:9000/test/outTransitionNavigation.html',

                        'http://localhost:9000/test/noTransitionEvents.html',
                        'http://localhost:9000/test/bothTransitionEvents.html',
                        'http://localhost:9000/test/inTransitionEvents.html',
                        'http://localhost:9000/test/outTransitionEvents.html',
                        
                        'http://localhost:9000/test/noTransitionRender.html',
                        'http://localhost:9000/test/bothTransitionRender.html',
                        'http://localhost:9000/test/inTransitionRender.html',
                        'http://localhost:9000/test/outTransitionRender.html',

                        'http://localhost:9000/test/bothTransitionLazyUrlEvents.html',
                        'http://localhost:9000/test/bothTransitionPreloadUrlEvents.html'
                    ]
                }
            }
        },
        watch: {
            files: [
                'src/*.js',
                'test/js/*.js',
                'test/js/pages/*.js'
            ],
            tasks: [
                'concat:standalone',
                'uglify:standalone',
                'browserify'
            ]
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
                dest: 'dist/blueRouter.js',
                nonull: true
            }
        },
        uglify: {
            standalone: {
                files: {
                    'dist/blueRouter.min.js': [ 'dist/blueRouter.js' ]
                }
            }
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
        }
    });

    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-browserify')

    require('google-closure-compiler').grunt(grunt, {
        platform: ['native', 'java', 'javascript'],
        max_parallel_compilations: require('os').cpus().length
    });
    // The load-grunt-tasks plugin won’t automatically load closure-compiler

    grunt.registerTask('test', ['qunit']);
    grunt.registerTask('default', [
        'closure-compiler:sample',
        'concat:standalone',
        'uglify:standalone',
        'browserify'
    ]);
    grunt.registerTask('all', ['default', 'test']);
};
