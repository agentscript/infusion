/*
Copyright 2013-2016 OCAD University
Copyright 2014-2016 Raising the Floor - International

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/* eslint-env node */
"use strict";

var _ = require("lodash");
var execSync = require("child_process").execSync;

/**
 * Returns a string result from executing a supplied command.
 * The command is executed synchronosly.
 *
 * @param {String} command - the command to execute
 * @param {Object} options - optional arguments "verbose" will output a full stack trace when an error occurs,
 *                           "defaultValue" will set the default return value, useful in case of errors or when a result may be an empty string.
 * @returns {String} - returns a string representation of the result of the command or the defaultValue.
 */
var getFromExec = function (command, options) {
    var result = options.defaultValue;
    var stderr = options.verbose ? "pipe" : "ignore";

    try {
        result = execSync(command, {stdio: ["pipe", "pipe", stderr]});
    } catch (e) {
        if (options.verbose) {
            console.log("Error executing command: " + command);
            console.log(e.stack);
        }
    }
    return result;
};

/**
* Returns the "full extension" of a filename containing
* multiple periods; common in minified/mapped JS file name
* conventions, such as "infusion-all.min.js.map"
* @param {String} filename - the filename to parse
* @returns {String} the extracted extension such as ".min.js.map"
*/
var getFullFilenameExtension = function (filename) {
    var firstPeriod = filename.indexOf(".");
    return filename.slice(firstPeriod);
};

/**
 * Rename function for grunt file tasks for  adding ".min" convention
 * to filename string; won't do anything to strings that already
 * include ".min"
 * @param {String} dest - supplied by Grunt task, see http://gruntjs.com/configuring-tasks#the-rename-property
 * @param {String} src - supplied by Grunt task, see http://gruntjs.com/configuring-tasks#the-rename-property
*/
var addMinifyToFilename = function (dest, src) {
    var fullExtension = getFullFilenameExtension(src);
    var minifiedExtension = ".min" + fullExtension;
    // Don't operate on files that already have a .min extension
    if (fullExtension.indexOf(".min.") > -1) {
        return dest + src;
    } else {
        return dest + src.replace(fullExtension, minifiedExtension);
    }
};

module.exports = function (grunt) {

    var setBuildSettings = function (settings) {
        grunt.config.set("buildSettings", {}); // delete previous settings
        _.forEach(settings, function (value, setting) {
            var settingPath = ["buildSettings", setting].join(".");
            grunt.config.set(settingPath, value);
        });
    };

    // Base distribution configuration
    // This should specify only the options for include/exclude;
    // a parallel "minify" set with options.compress: true
    // will be generated for the final configuration
    var baseDistributions =
        {
            "all": {},
            "all-no-jquery": {
                options: {
                    exclude: "jQuery, jQueryUI"
                }
            },
            "framework": {
                options: {
                    include: "framework"
                }
            },
            "framework-no-jquery": {
                options: {
                    include: "framework",
                    exclude: "jQuery, jQueryUI"
                }
            }
        };

    // Create a parallel set of minified configuration distributions
    var minifiedDistributions = _.transform(_.cloneDeep(baseDistributions), function (accumulator, value, key) {
        var minKey = key + ".min";
        accumulator[minKey] = value;
        var options = accumulator[minKey].options ? accumulator[minKey].options : {};
        options.compress = true;
        accumulator[minKey].options = options;
    }, {});

    // Create final combined distributions object
    // for use by the initial configuration
    var combinedDistributions = _.merge(baseDistributions, minifiedDistributions);

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        revision: getFromExec("git rev-parse --verify --short HEAD", {defaultValue: "Unknown revision, not within a git repository"}),
        branch: getFromExec("git rev-parse --abbrev-ref HEAD", {defaultValue: "Unknown branch, not within a git repository"}),
        allBuildName: "<%= pkg.name %>-all",
        buildSettings: {}, // set by the build tasks
        customBuildName: "<%= pkg.name %>-<%= buildSettings.name %>",
        banner: "/*!\n <%= pkg.name %> - v<%= pkg.version %>\n <%= grunt.template.today('dddd, mmmm dS, yyyy, h:MM:ss TT') %>\n branch: <%= branch %> revision: <%= revision %>*/\n",
        clean: {
            build: "build",
            products: "products",
            stylus: "src/framework/preferences/css/*.css",
            stylusDist: "dist/assets/**/stylus", // removes the empty stylus directory from the distribution
            ciArtifacts: ["*.tap"],
            dist: "dist",
            postBuild: {
                files: [{}]
            }
        },
        copy: {
            all: {
                files: [{
                    expand: true,
                    src: ["src/**", "tests/**", "demos/**", "examples/**"],
                    dest: "build/"
                }]
            },
            custom: {
                files: [{
                    expand: true,
                    src: "<%= modulefiles.custom.output.dirs %>",
                    dest: "build/"
                }]
            },
            necessities: {
                files: [{
                    src: ["README.*", "ReleaseNotes.*", "Infusion-LICENSE.*"],
                    dest: "build/"
                }, {
                    // The jQuery license file needs to be copied explicitly since
                    // "src/lib/jQuery" directory contains several jQuery modules
                    // that have individual dependencies.json files.
                    src: "src/lib/jQuery/jQuery-LICENSE.txt",
                    dest: "build/lib/jQuery/jQuery-LICENSE.txt",
                    filter: function () {
                        return grunt.file.exists("build/lib/jQuery/");
                    }
                }]
            },
            distJS: {
                files: [{
                    expand: true,
                    cwd: "build/",
                    src: "<%= allBuildName %>.*",
                    dest: "dist/",
                    rename: function (dest, src) {
                        return grunt.config.get("buildSettings.compress") ? addMinifyToFilename(dest, src) : dest + src;
                    }
                }, {
                    expand: true,
                    cwd: "build/",
                    src: "<%= customBuildName %>.*",
                    dest: "dist/",
                    rename: function (dest, src) {
                        return grunt.config.get("buildSettings.compress") ? addMinifyToFilename(dest, src, "js") : dest + src;
                    }
                }]
            },
            distAssets: {
                files: [{
                    expand: true,
                    cwd: "build/",
                    src: ["src/lib/fonts/**", "src/framework/preferences/fonts/**", "src/framework/preferences/images/**"],
                    dest: "dist/assets/"
                }]
            }
        },
        uglify: {
            options: {
                banner: "<%= banner %>",
                mangle: false,
                sourceMap: true,
                sourceMapIncludeSources: true
            },
            all: {
                files: [{
                    src: "<%= modulefiles.all.output.files %>",
                    dest: "./build/<%= allBuildName %>.js"
                }]
            },
            custom: {
                files: [{
                    src: "<%= modulefiles.custom.output.files %>",
                    dest: "./build/<%= customBuildName %>.js"
                }]
            }
        },
        modulefiles: {
            all: {
                src: ["src/**/*Dependencies.json"]
            },
            custom: {
                options: {
                    exclude: "<%= buildSettings.exclude %>",
                    include: "<%= buildSettings.include %>"
                },
                src: ["src/**/*Dependencies.json"]
            }
        },
        map: {
            // append "/**" to the end of all of all of
            // directory paths for copy:custom to ensure that
            // all of the subdirectories and files are copied over
            copyDirs: {
                files: "<%= copy.custom.files %>",
                prop: "copy.custom.files.0.src",
                fn: function (str) {
                    return str + "/**";
                }
            },
            postBuildClean: {
                files: "<%= clean.postBuild.files %>",
                prop: "clean.postBuild.files.0.src",
                fn: function (str) {
                    var buildPath = "build/";
                    return str.startsWith(buildPath) ? str : buildPath + str;
                }
            }
        },
        // Still need the concat task as uglify does not honour the {compress: false} option
        // see: https://github.com/mishoo/UglifyJS2/issues/696
        concat: {
            options: {
                separator: ";\n",
                banner: "<%= banner %>",
                sourceMap: true
            },
            all: {
                nonull: true,
                cwd: "./build/", // Src matches are relative to this path.
                src: "<%= modulefiles.all.output.files %>",
                dest: "./build/<%= allBuildName %>.js"
            },
            custom: {
                nonull: true,
                cwd: "./build/", // Src matches are relative to this path.
                src: "<%= modulefiles.custom.output.files %>",
                dest: "./build/<%= customBuildName %>.js"
            }
        },
        compress: {
            all: {
                options: {
                    archive: "products/<%= allBuildName %>-<%= pkg.version %>.zip"
                },
                files: [{
                    expand: true,     // Enable dynamic expansion.
                    cwd: "./build/",      // Src matches are relative to this path.
                    src: ["**/*"], // Actual pattern(s) to match.
                    dest: "./infusion"   // Destination path prefix in the zip package
                }]
            },
            custom: {
                options: {
                    archive: "products/<%= customBuildName %>-<%= pkg.version %>.zip"
                },
                files: "<%= compress.all.files %>"
            }
        },
        eslint: {
            all: ["src/**/*.js", "tests/**/*.js", "demos/**/*.js", "examples/**/*.js", "*.js"]
        },
        jsonlint: {
            all: ["src/**/*.json", "tests/**/*.json", "demos/**/*.json", "examples/**/*.json"]
        },
        stylus: {
            compile: {
                options: {
                    compress: "<%= buildSettings.compress %>",
                    relativeDest: ".."
                },
                files: [{
                    expand: true,
                    src: ["src/**/css/stylus/*.styl"],
                    ext: ".css"
                }]
            },
            dist: {
                options: {
                    compress: "<%= buildSettings.compress %>",
                    relativeDest: ".."
                },
                files: [{
                    expand: true,
                    src: ["src/**/css/stylus/*.styl"],
                    ext: "<% buildSettings.compress ? print('.min.css') : print('.css') %>",
                    dest: "dist/assets/"
                }]
            }
        },
        // grunt-contrib-watch task to watch and rebuild stylus files
        // automatically when doing stylus development
        watch: {
            buildStylus: {
                files: ["src/**/css/stylus/*.styl", "src/**/css/stylus/utils/*.styl"],
                tasks: "buildStylus"
            }
        },
        shell: {
            runTests: {
                command: "vagrant ssh -c 'cd /home/vagrant/sync/; DISPLAY=:0 testem ci --file tests/testem.json'"
            }
        },
        distributions: combinedDistributions
    });

    // Load the plugins:
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-compress");
    grunt.loadNpmTasks("fluid-grunt-eslint");
    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("grunt-modulefiles");
    grunt.loadNpmTasks("grunt-contrib-stylus");
    grunt.loadNpmTasks("grunt-shell");
    grunt.loadNpmTasks("grunt-contrib-watch");

    // Custom tasks:

    // Simple task for transforming a property
    grunt.registerMultiTask("map", "a task wrapper around the map function from lodash", function () {
        var transformed = _.map(this.filesSrc, this.data.fn);
        grunt.config.set(this.data.prop, transformed);
    });

    grunt.registerTask("pathMap", "Triggers the map task for the specified build target", function (target) {
        grunt.task.run("map:postBuildClean");
        if (target === "custom") {
            grunt.task.run("map:copyDirs");
        }
    });

    grunt.registerTask("setPostBuildCleanUp", "Sets the file source for post build cleanup", function (target) {
        grunt.config.set("clean.postBuild.files.0.src", "<%= modulefiles." + target + ".output.files %>");
    });

    // Task for organizing the build
    grunt.registerTask("build", "Generates a minified or source distribution for the specified build target", function (target) {
        target = target || "all";
        setBuildSettings({
            name: grunt.option("name") || "custom",
            exclude: grunt.option("exclude"),
            include: grunt.option("include"),
            compress: !grunt.option("source"),
            target: target
        });
        var concatTask = grunt.config.get("buildSettings.compress") ? "uglify:" : "concat:";
        var tasks = [
            "clean",
            "lint",
            "stylus:compile",
            "modulefiles:" + target,
            "setPostBuildCleanUp:" + target,
            "pathMap:" + target,
            "copy:" + target,
            "copy:necessities",
            concatTask + target,
            "compress:" + target,
            "clean:postBuild"
        ];
        grunt.task.run(tasks);
    });

    grunt.registerMultiTask("distributions", "Enables a project to split its files into a set of modules. A module's information is stored in a json file containing a name for the module, the files it contains, and other modules it depends on. The module files can then be accumulated into various configurations of included and excluded modules, which can be fed into other plugins (e.g. grunt-contrib-concat) for packaging.", function () {
        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
            name: this.target,
            source: true,
            target: "all",
            compress: false
        });

        if (options.exclude || options.include) {
            options.target = "custom";
        }

        setBuildSettings(options);

        var concatTask = options.compress ? "uglify:" : "concat:";
        var tasks = [
            "cleanForDist",
            "stylus:dist",
            "modulefiles:" + options.target,
            "pathMap:" + options.target,
            "copy:" + options.target,
            "copy:necessities",
            concatTask + options.target,
            "copy:distJS",
            "copy:distAssets"
        ];
        grunt.task.run(tasks);
    });

    grunt.registerTask("buildDists", "Tasks to run before publishing to NPM", function (target) {
        var tasks = [
            "clean",
            "lint",
            "distributions" + ( target ? ":" + target : "" ),
            "cleanForDist",
            "verifyDists"
        ];
        grunt.task.run(tasks);
    });

    grunt.registerTask("verifyDists", "Verifies that the expected /dist/*.js files and their source maps were created", function () {
        grunt.log.subhead("Verifying that expected distribution files are present in /dist directory");
        var missingDistributions = 0;
        var distributions = grunt.config.get("distributions");
        _.forEach(distributions, function (value, distribution) {
            grunt.log.subhead("Distribution \"" + distribution + "\"");
            var jsFilename = "infusion-" + distribution + ".js";
            var mapFilename = jsFilename + ".map";
            var expectedFilenames = [jsFilename, mapFilename];
            _.forEach(expectedFilenames, function (expectedFilename) {
                var fileExists = grunt.file.exists("dist", expectedFilename);
                if (fileExists) {
                    grunt.log.oklns("└─╴" + expectedFilename + " - ✓ Present".green);
                } else {
                    missingDistributions = missingDistributions + 1;
                    grunt.log.errorlns("└─╴" + expectedFilename + " - ✗ Missing".red);
                }
            });
        });
        if (missingDistributions > 0) {
            grunt.log.subhead("Verification failed".red);
            grunt.fail.fatal(missingDistributions + " expected /dist files were not found");
        } else {
            grunt.log.oklns("All expected distribution files present");
        }

    });

    grunt.registerTask("cleanForDist", ["clean:build", "clean:products", "clean:stylus", "clean:stylusDist", "clean:ciArtifacts"]);
    grunt.registerTask("buildStylus", ["clean:stylus", "stylus:compile"]);

    grunt.registerTask("default", ["build:all"]);
    grunt.registerTask("custom", ["build:custom"]);

    grunt.registerTask("lint", "Apply eslint and jsonlint", ["eslint", "jsonlint"]);

    grunt.registerTask("tests", "Run tests", ["shell:runTests"]);
};
