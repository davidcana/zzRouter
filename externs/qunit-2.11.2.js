var QUnit = {
    "isLocal": {},
    "version": {},
    "on": function () {},
    "module": function () {},
    "test": function () {},
    "todo": function () {},
    "skip": function () {},
    "only": function () {},
    "start": function () {},
    "config": {
        "queue": function () {},
        "blocking": {},
        "reorder": {},
        "altertitle": {},
        "collapse": {},
        "scrolltop": {},
        "maxDepth": {},
        "requireExpects": {},
        "urlConfig": {
            "0": {
                "id": {},
                "label": {},
                "tooltip": {}
            },
            "1": {
                "id": {},
                "label": {},
                "tooltip": {}
            },
            "2": {
                "id": {},
                "label": {},
                "tooltip": {}
            }
        },
        "modules": function () {},
        "currentModule": {
            "name": {},
            "tests": {
                "0": {
                    "name": {},
                    "testId": {},
                    "skip": {}
                }
            },
            "childModules": function () {},
            "testsRun": {},
            "unskippedTestsRun": {},
            "hooks": function () {},
            "suiteReport": {
                "name": {},
                "fullName": function () {},
                "tests": {
                    "0": {
                        "name": {},
                        "suiteName": {},
                        "fullName": {
                            "0": {}
                        },
                        "runtime": {},
                        "assertions": {
                            "0": {
                                "passed": {},
                                "message": {},
                                "stack": {},
                                "todo": {}
                            }
                        },
                        "skipped": {},
                        "todo": {},
                        "valid": {},
                        "_startTime": {},
                        "_endTime": {}
                    }
                },
                "childSuites": function () {},
                "_startTime": {},
                "_endTime": {}
            },
            "stats": {
                "all": {},
                "bad": {},
                "started": {}
            }
        },
        "callbacks": {
            "begin": {
                "0": function () {},
                "1": function () {},
                "2": function () {}
            },
            "done": {
                "0": function () {}
            },
            "log": {
                "0": function () {}
            },
            "testStart": {
                "0": function () {},
                "1": function () {}
            },
            "testDone": {
                "0": function () {}
            },
            "moduleStart": function () {},
            "moduleDone": function () {}
        },
        "storage": {
            "qunit-test--global failure": {},
            "key": function () {},
            "getItem": function () {},
            "setItem": function () {},
            "removeItem": function () {},
            "clear": function () {},
            "length": {}
        },
        "moduleId": function () {},
        "testId": function () {},
        "module": {},
        "filter": {},
        "pageLoaded": {},
        "stats": {
            "all": {},
            "bad": {},
            "testCount": {}
        },
        "started": {},
        "updateRate": {},
        "autostart": {},
        "hidepassed": {},
        "noglobals": {},
        "notrycatch": {},
        "depth": {},
        "current": {},
        "pollution": function () {}
    },
    "is": function () {},
    "objectType": function () {},
    "extend": function () {},
    "load": function () {},
    "stack": function () {},
    "onError": function () {},
    "onUnhandledRejection": function () {},
    "pushFailure": function () {},
    "assert": {
        "raises": function () {}
    },
    "equiv": function () {},
    "dump": {
        "parse": function () {},
        "typeOf": function () {},
        "separator": function () {},
        "indent": function () {},
        "up": function () {},
        "down": function () {},
        "setParser": function () {},
        "quote": function () {},
        "literal": function () {},
        "join": function () {},
        "depth": {},
        "maxDepth": {},
        "parsers": {
            "window": {},
            "document": {},
            "error": function () {},
            "unknown": {},
            "null": {},
            "undefined": {},
            "function": function () {},
            "array": function () {},
            "nodelist": function () {},
            "arguments": function () {},
            "object": function () {},
            "node": function () {},
            "functionArgs": function () {},
            "key": function () {},
            "functionCode": {},
            "attribute": function () {},
            "string": function () {},
            "date": function () {},
            "regexp": function () {},
            "number": function () {},
            "boolean": function () {},
            "symbol": function () {}
        },
        "HTML": {},
        "indentChar": {},
        "multiline": {}
    },
    "begin": function () {},
    "done": function () {},
    "log": function () {},
    "testStart": function () {},
    "testDone": function () {},
    "moduleStart": function () {},
    "moduleDone": function () {},
    "urlParams": function () {},
    "diff": function () {}
};

var assert = {
    /**
     * @param {string} name
     * @param {Object=} lifecycle
     */
    "module": function(name, lifecycle) {},

    /**
     * @param {string} title
     * @param {number|Function} expected
     * @param {Function=} test_func
     */
    "test": function(title, expected, test_func){},

    /**
     * @param {string} name
     * @param {number|Function} expected
     * @param {Function=} test_func
     */
    "asyncTest": function(name, expected, test_func){},

    /**
     * @param {number} amount
     */
    "expect": function(amount){},

    /**
     * @param {*} state
     * @param {string=} message
     */
    "ok": function(state, message){},

    /**
     * @param {*} state
     * @param {string=} message
     */
    "notOk": function(state, message){},
    
    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "equal": function(actual, expected, message){},

    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "notEqual": function(actual, expected, message){},

    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "deepEqual": function(actual, expected, message){},

    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "notDeepEqual": function(actual, expected, message){},

    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "strictEqual": function(actual, expected, message){},

    /**
     * @param {*} actual
     * @param {*} expected
     * @param {string=} message
     */
    "notStrictEqual": function(actual, expected, message){},

    /**
     * @param {number=} increment
     */
    "start": function(increment){},

    /**
     * @param {number=} increment
     */
    "stop": function(increment){},
    
    /**
     * @param {Object} data
     */
    "pushResult": function(data){},
    
    /**
     * @param {Function} blockFn
     * @param {string=} expectedMatcher
     * @param {string=} message
     */
    "throws": function(blockFn, expectedMatcher, message){}
};
