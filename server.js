/*jslint white:true,node:true*/
'use strict';
var Promise = require('bluebird');
var staticServer = require('node-static');
var path = require('path');
var fs = Promise.promisifyAll(require('fs'));
var execAsync = Promise.promisify(require('child_process').exec);
var open = require('open');
var yaml = require('js-yaml');
var pathExists = require('path-exists');

function determineRootDir(state) {
    return Promise.try(function () {
//        var rootDir = path.normalize(['src', 'cdn'].join('/'));
//        state.rootDir = rootDir;
        state.rootDir = state.args.dir || state.config.server.root;
        return state;
    });
    
//    return fs.existsAsync(rootDir)
//        .then(function (exists) {
//            console.log('Exists? ', exists);
//            if (!exists) {
//                throw new Error('root dir ' + rootDir + ' does not exist or is not accessible to you');
//            }
//            config.rootDir = rootDir;
//            console.log('Got root dir: ', rootDir);
//            return config;
//        });
}

function loadYaml(path) {
    var yamlPath = path.join('/');
    return fs.readFileAsync(yamlPath, 'utf8')
        .then(function (contents) {
            return yaml.safeLoad(contents);
        });
}

function loadConfig(state) {
    return loadYaml(['config.yml'])
        .then(function (config) {
            state.config = config;
            return state;
        });
}

function start(state) {
    var port = state.config.server.port,
        title = 'kbcdn-' + String(port);

    console.log('Starting local CDN server');
    console.log('Directory : ' + state.rootDir);
    console.log('Port      : ' + port);

    process.title = title;
    var file = new staticServer.Server(state.rootDir, {cache: false});
    console.log('root: ' + state.rootDir);

    require('http').createServer(function (request, response) {
        request.addListener('end', function () {
            // 
            // Serve files! 
            // 
            file.serve(request, response)
                .addListener('error', function (err) {
                    console.log('ERROR: ' + request.url + ':' + err.message);
                });

        }).resume();
    }).listen(port);
    console.log('Preview server started as process: ' + title + ', with id: ' + String(process.pid));
}

function getServerPid(port) {
    var title;
    return execAsync('ps -o pid,command')
        .then(function (stdout, stderr) {
            title = 'kbcdn-' + String(port);
            return stdout.toString()
                .split('\n')
                .map(function (item) {
                    return item.trim(' ').split(/[ ]+/);
                })
                .filter(function (row) {
                    if (row.length < 2) {
                        return false;
                    }
                    if (row[1] === title) {
                        return true;
                    }
                    return false;
                });
        })
        .then(function (procs) {
            if (procs.length === 1) {
                var pid = parseInt(procs[0], 10);
                return pid;
            }
            if (procs.length === 0) {
                throw new Error('No processes matched ' + title);
            }
            throw new Error('Too many processes matched ' + title);
        });
}

function stop(state) {
    // yeah, well, we'll improve this...
    console.log('Stopping server on port ' + state.config.server.port);
    getServerPid(state.config.server.port)
        .then(function (pid) {
            console.log('PID: ' + pid);
            process.kill(pid);
        });
}

function preview(state) {
    getServerPid(state.config.build.server.port)
        .then(function () {
            var port = state.config.build.server.port;
            var url = 'http://localhost:' + String(port);
            console.log('Opening browser for ' + url);
            open(url);
        })
        .catch(function (err) {
            console.error('Cannot preview the site -- server not started');
            console.error(err);
            throw err;
        });
}

function usage() {
    console.log('node server <cmd>');
}

function main(state) {
        loadConfig(state)
        .then(function (state) {
            return determineRootDir(state);
        })
        .then(function (state) {
            switch (state.args.action) {
                case 'start':
                    start(state);
                    break;
                case 'stop':
                    stop(state);
                    break;
                case 'preview':
                    preview(state);
                    break;
                default:
                    usage(state);
            }
        })
        .catch(function (err) {
            console.log('ERROR');
            console.log(err);
            usage();
        });
}

var action = process.argv[2];
if (action === undefined) {
    throw new Error('action required: node server <action>');
}

var dir = process.argv[3];

main({
    args: {
        action: action,
        dir: dir
    },
    config: {        
    }
});