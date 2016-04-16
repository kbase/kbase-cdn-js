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
        glob = Promise.promisify(require('glob').Glob);

// UTILS

    function loadYaml(yamlPath) {
        return fs.readFileAsync(yamlPath.join('/'), 'utf8')
            .then(function (contents) {
                return yaml.safeLoad(contents);
            });
    }
    
    function makeDist(state) {
        return fs.removeAsync(state.distDir)
            .then(function () {
                return fs.ensureDirAsync(state.distDir);
            })
            .then(function () {        
                return fs.moveAsync([state.buildDir, 'bin'].join('/'), [state.distDir, 'bin'].join('/'));
            })
            .then(function () {        
                return fs.moveAsync([state.buildDir, 'source'].join('/'), [state.distDir, 'source'].join('/'));
            })
            .then(function () {
                    return state;
            });
    }

    function buildDist(state) {
        var root = state.buildDir,
            source = [root, 'source'].join('/'),
            dest = [root, 'bin'].join('/'),
            uglify = require('uglify-js');
        console.log('Building the distribution, this may take a bit...');
        return fs.copyAsync(source, dest)
            .then(function () {
                return glob([dest, '**', '*.js'].join('/'))
                    .then(function (matches) {
                        return Promise.all(matches.map(function (match) {
                            var result = uglify.minify(match, {outSourceMap: 'out.js.map'});
                            return fs.writeFileAsync(match, result.code)
                                .then(function () {
                                    fs.writeFileAsync(match + '.map', result.map);
                                });
                        }));
                    });
            })
            .then(function () {
                return makeDist(state);
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
                return buildDist(state);
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