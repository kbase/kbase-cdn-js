/*
 * Build
 * Build the CDN
 */

/*
 * build
 * make build dir
 * load the libraries.yml file
 * for each package
 * for each version
 * create a temp dir
 * cd into temp dir
 * bower install the package
 * using the instructions copy the package into the build dir
 * for bowerMain: copy each of the specified files
 * if reroot, then copy the file to the root
 * if reroot with path, then copy the file into the path which is the original path with the reroot path removed
 * for custom: copy according to
 * main: treat it like bower main
 * reroot: treat like bowerMain reroot
 */

/*global define*/
/*jslint white:true,node:true*/
(function () {
    'use strict';

    var Promise = require('bluebird'),
        fs = Promise.promisifyAll(require('fs-extra')),
        pathExists = require('path-exists'),
        yaml = require('js-yaml'),
        bower = require('bower'),
        glob = Promise.promisify(require('glob').Glob);

// UTILS

    function loadYaml(yamlPath) {
        return fs.readFileAsync(yamlPath.join('/'), 'utf8')
            .then(function (contents) {
                return yaml.safeLoad(contents);
            });
    }

// SUB TASKS

    /* Clean up after build */
    function cleanup(state) {
        return fs.removeAsync([state.buildDir, 'temp'].join('/'))
            .then(function () {
                return state;
            });
    }

// STATE
// initial state
    /*
     * filesystem: an initial set files files
     */

    function ensureBuildEnv(state) {
        return pathExists(state.buildDir)
            .then(function (exists) {
                if (exists) {
                    throw new Error('Build directory exists -- clean it first to rebuild');
                }
                return fs.ensureDirSync(state.buildDir);
            })
            .then(function () {
                return state;
            });
    }

    var uniqState = {};
    function uniq(prefix) {
        if (!uniqState[prefix]) {
            uniqState[prefix] = 0;
        }
        uniqState[prefix] += 1;
        return prefix + String(uniqState[prefix]);
    }


    function copyFiles2(dir, file, destDir, options) {
        var fromPath = [dir, file].join('/'),
            filePath = file.split('/'),
            fileParentPath = filePath.slice(0, filePath.length - 1),
            fileName = filePath[filePath.length - 1],
            destFilePath;
        if (options.justFile) {
            destFilePath = [destDir, fileName].join('/');
        } else if (options.removePrefix) {
            destFilePath = [destDir, fileParentPath.slice(options.removePrefix).join('/'), fileName].join('/');
        } else {
            destFilePath = [destDir, fileParentPath.join('/'), fileName].join('/');
        }
        return pathExists(fromPath)
            .then(function (exists) {
                if (!exists) {
                    throw new Error('Source file does not exist: ' + fromPath);
                }
                // return fs.ensureDirAsync(destPath);
            })
            .then(function () {
                // console.log('COPY', fromPath, destPath, options);
                return fs.copyAsync(fromPath, destFilePath, {clobber: false});
            })
            .catch(function (err) {
                console.error('ERROR', err);
            });
    }

    function resolveFiles(cwd, files) {
        var allFiles = [];
        return Promise.all(files.map(function (globExpr) {
            return glob(globExpr, {
                cwd: cwd
            })
                .then(function (matches) {
                    matches.forEach(function (match) {
                        allFiles.push(match);
                    });
                });
        }))
            .then(function () {
                return allFiles;
            });
    }

    function installBowerMain(bowerDir, destDir, packageDef) {
        var packageDir = [bowerDir, 'bower_components', packageDef.installedDirectory || packageDef.name].join('/'),
            packageOptions = packageDef.install || {};
        return fs.readFileAsync([packageDir, 'bower.json'].join('/'), 'utf-8')
            .then(function (file) {
                var config = JSON.parse(file),
                    main = config.main,
                    removeAllPath, removePath;
                if (packageOptions) {
                    if (packageOptions.removeAllPath) {
                        removeAllPath = true;
                    } else if (packageOptions.removePath) {
                        removePath = packageOptions.removePath;
                    }
                }
                if (typeof main === 'string') {
                    main = [main];
                }
                if (!main) {
                    throw new Error('No bower main, please make this a custom install: ' + packageDef.name);
                }
                return resolveFiles(packageDir, main, packageDef.name)
                    .then(function (files) {
                        Promise.all(files
                            .filter(function (file) {
                                if (packageOptions.exclude) {
                                    if (packageOptions.exclude.some(function (excluded) {
                                        return (excluded === file);
                                    })) {
                                        return false;
                                    }
                                }
                                return true;
                            })
                            .map(function (file) {
                                return copyFiles2(packageDir, file, destDir, {
                                    justFile: removeAllPath,
                                    removePrefix: removePath ? removePath.split('/').length : false
                                });
                            }));
                    });

            });
    }

    function installCustom(bowerDir, destDir, packageDef) {
        var packageDir = [bowerDir, 'bower_components', packageDef.name].join('/'),
            packageOptions = packageDef.install,
            files = packageDef.install.files,
            sourceDir;
        if (packageOptions.startPath) {
            sourceDir = [packageDir, packageOptions.startPath].join('/');
        } else {
            sourceDir = packageDir;
        }

        return resolveFiles(sourceDir, files, packageDef.name)
            .then(function (files) {
                return Promise.all(files
                    .filter(function (file) {
                        if (packageOptions.exclude) {
                            if (packageOptions.exclude.some(function (excluded) {
                                return (excluded === file);
                            })) {
                                return false;
                            }
                        }
                        return true;
                    })
                    .map(function (file) {
                        return copyFiles2(sourceDir, file, destDir, {});
                    }));
            });
    }
    /*
     *
     */
    function installBowerPackage(packageDef, state) {
        var buildBase = state.buildDir,
            tempPath = [buildBase, 'temp', uniq('temp_')].join('/'),
            packageName = packageDef.package || packageDef.name,
            packageString = packageName + '#' + packageDef.bowerVersion,
            destDir = [state.buildDir, 'source', packageDef.name, packageDef.cdnVersion].join('/');

        return Promise.try(function () {
            console.log('Installing package ' + packageName);
        })
            .then(function () {
                return fs.ensureDirAsync(tempPath);
            })
            .then(function () {
                return Promise.try(function () {
                    return new Promise(function (resolve, reject) {
                        bower.commands
                            .install([packageString], {}, {
                                cwd: tempPath,
                                timeout: 300000
                            })
                            .on('end', function (installed) {
                                resolve(installed);
                            })
                            .on('error', function (err) {
                                reject(err);
                            });
                    });
                });
            })
            .then(function () {
                return fs.ensureDirAsync(destDir);
            })
            .then(function () {
                var method;
                if (!packageDef.install) {
                    method = 'bowerMain';
                } else {
                    if (packageDef.install.method) {
                        method = packageDef.install.method;
                    } else {
                        method = 'bowerMain';
                    }
                }
                switch (method) {
                    case 'bowerMain':
                        return installBowerMain(tempPath, destDir, packageDef);
                    case 'custom':
                        return installCustom(tempPath, destDir, packageDef);
                    default:
                        console.log('** skippping ' + method + '**');
                }
            })
            .then(function () {
                console.log('Finished installing package ' + packageDef.name);
            });
    }


    function installLibraries(state) {
        var toInstall = [];
        state.libraries.bower.forEach(function (library) {
            library.versions.forEach(function (version) {
                var packageDef;
                if (typeof version === 'string') {
                    packageDef = {
                        bowerVersion: version,
                        cdnVersion: version
                    };
                } else {
                    packageDef = {
                        bowerVersion: version.bower,
                        cdnVersion: version.cdn
                    };
                }
                packageDef.name = library.name;
                if (library.installedDirectory) {
                    packageDef.installedDirectory = library.installedDirectory;
                }
                if (library.install) {
                    packageDef.install = library.install;
                }
                if (library.package) {
                    packageDef.package = library.package;
                }
                toInstall.push(packageDef);
            });
        });
        return Promise.all(toInstall.map(function (install) {
            return installBowerPackage(install, state);
        }))
            .then(function () {
                return state;
            });
    }

    function main() {
        return Promise.try(function () {
            var state = {
                buildDir: './dev/build',
                distDir: './dist'
            };
            return state;
        })
            .then(function (state) {
                return ensureBuildEnv(state);
            })
            .then(function (state) {
                return loadYaml(['libraries.yml'])
                    .then(function (libraries) {
                        state.libraries = libraries;
                        return state;
                    });
            })
            .then(function (state) {
                return installLibraries(state);
            })
            .then(function (state) {
                return cleanup(state);
            });
    }

    main()
        .then(function () {
            console.log('COMPLETED');
        })
        .catch(function (err) {
            console.error('ERROR', err);
        })
        .finally(function () {
            console.log('DONE');
        });

}());