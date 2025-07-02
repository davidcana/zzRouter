module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
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
        'closure-compiler': {
            sample: {
                options: {
                    js: [
                        'src/zzRouter.js', 
                        'src/defaultOptions.js',
                        'src/htmlFetcher.js',
                        'src/utils.js',
                        'src/version.js',
                        'samples/sample.js',
                        'samples/pages/textWriter.js',
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

    require('google-closure-compiler').grunt(grunt, {
        platform: ['native', 'java', 'javascript'],
        max_parallel_compilations: require('os').cpus().length
    });
    // The load-grunt-tasks plugin won’t automatically load closure-compiler

    grunt.registerTask('test', ['qunit']);
    grunt.registerTask('default', [
        'closure-compiler:sample'
    ]);
    grunt.registerTask('all', ['default', 'test']);
};
