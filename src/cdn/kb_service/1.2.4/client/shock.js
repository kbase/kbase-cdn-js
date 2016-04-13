/*global define*/
/*jslint white:true,browser:true*/

/*
 Shock javascript client library
 
 This library allows the interaction with the Shock via javascript methods. The normal usage would be to first initialize the library with an authentication token and Shock url. It can then be used to retrieve, delete, update and create nodes in Shock. Refer to the function section below for details on the provided function calls. The upload of files uses chunking and automatically resumes failed uploads when the same file is uploaded again by the same user.
 
 FUNCTIONS
 
 constructor (params)
 initialize the Data Store client with: new ShockClient({ token: "myTokenString", url: "urlToShock", chunkSize: 2097152 })
 
 get_node
 retrieve a node from SHOCK with shockClient.get_node("myNodeId", retCallback, )
 The node-id parameter is mandatory. This function returns a promise that is fulfilled once the node is retrieved. The callback parameters in case they're defined should be functions.
 
 get_nodes
 retrieve all nodes for the current authentication setting with: shockClient.get_all_nodes({"my_prop": "my_value"}, retCallback, errorCallback)
 This function returns a promise that is fulfilled once the nodes are retrieved. The callback parameters in case they're defined should be functions.
 
 delete_node
 delete a node from SHOCK with shockClient.get_node("myNodeId", retCallback, errorCallback)
 The node-id parameter is mandatory. This function returns a promise that is fulfilled once the node is deleted. The callback parameters in case they're defined should be functions.
 
 upload_node
 create a new node with: shockClient.upload_node(file, shockNodeId, searchToResume, retCallback, errorCallback, cancelCallback)
 The input parameter is a file from input form field. If no file is to be added to the node, this parameter must be null. The callback parameters in case they're defined should be functions.
 
 update_node
 update the attributes of an existing node with: shockClient.update_node("myNodeId", attributes, retCallback, errorCallback)
 The attributes parameter must be a JSON structure of metadata that is to be added to the node. Existing values will be replaced. This function returns a promise that is fulfilled once the node is updated. The callback parameters in case they're defined should be functions.
 
 This code was built based on https://github.com/MG-RAST/Shock/blob/master/libs/shock.js .
 Authors: Tobias Paczian <paczian@mcs.anl.gov>, Roman Sutormin <rsutormin@lbl.gov> .
 */

define([
    'jquery',
    'bluebird'
], function ($, Promise) {
    'use strict';

    function getRequest(url, token) {
        var header = {};
        if (token) {
            header.Authorization = 'OAuth ' + token;
        }
        return Promise.try(function () {
            return $.ajax({
                url: url,
                type: 'GET',
                headers: header
            });
        })
            .then(function (data) {
                return data.data;
            });
    }

    function deleteRequest(url, token) {
         var header = {};
        if (token) {
            header.Authorization = 'OAuth ' + token;
        }
        return Promise.try(function () {
            return $.ajax({
                url: url,
                type: 'DELETE',
                headers: header
            });
        });
    }

    function putRequest(url, token, fd) {
         var header = {};
        if (token) {
            header.Authorization = 'OAuth ' + token;
        }
        return Promise.try(function () {
            return $.ajax({
                url: url,
                type: 'PUT',
                headers: header,
                contentType: false,
                processData: false,
                data: fd
            });
        })
            .then(function (data) {
                return data.data;
            });
    }

    function encodeQuery(params) {
        return Object.keys(params)
            .map(function (key) {
                var value = params[key];
                if (value === true) {
                    return key;
                }
                if (value === false) {
                    return false;                    
                }
                return [encodeURIComponent(key), encodeURIComponent(params[key])].join('=');
            })
            .filter(function (field) {
                if (field === false) {
                    return false;
                }
                return true;
            })
            .join('&');
    }

    function ShockClient(params) {
        var self = this;
        
        self.auth_header = {};
        self.chunkSize = 2097152;

        if (params.url === undefined) {
            throw new Error('Missing parameter "url"');
        }
        self.url = params.url;

        if (params.token) {
            self.token = params.token;
        }

        if (params.chunkSize) {
            self.chunkSize = params.chunkSize;
        }

        self.get_node = function (node) {
            var url = [self.url, 'node', node].join('/');
            return getRequest(url, self.token);
        };

        self.get_nodes = function (options) {
            var url = [self.url, 'node'].join('/'),
                query = {};
            if (options.query) {
                query = options.query;
                query.query = true;
            } else if (options.queryNode) {
                query = options.queryNode;
                query.querynode = true;
            }
            if (options.owner) {
                query.owner = options.owner;
            }
            if (options.limit) {
                query.limit = options.limit;
            }
            if (options.offset) {
                query.offset = options.offset;
            }
            url += '?' + encodeQuery(query);
            return getRequest(url, self.token);
        };

        self.get_node_acls = function (id) {
            var url = [self.url, 'node', id, "acl"].join('/');
            return getRequest(url, self.token);
        };

        self.delete_node = function (id) {
            var url = [self.url, 'node', id].join('/');
            return deleteRequest(url, self.token);
        };

        self.update_node = function (node, attr) {
            var url = [self.url, 'node'].join('/'),
                aFileParts = [JSON.stringify(attr)],
                oMyBlob = new Blob(aFileParts, {"type": "text\/json"}),
                fd = new FormData();
            fd.append('attributes', oMyBlob);
            return putRequest(url, self.token, fd);
        };

        self.check_file = function (file) {
            var fsize = file.size,
                ftime = file.lastModifiedDate.getTime(),
                filters = {
                    file_size: fsize,
                    file_time: ftime,
                    file_name: file.name,
                    limit: 1
                };

            return self.get_nodes(filters)
                .then(function (data) {
                    if (data.length === 0) {
                        return null;
                    }
                    return data[0];
                });
        };
        
        /**
         * Changes file.name prop indide shock node. Use this func at the end of chunk upload.
         */
        self.change_node_file_name = function (shockNodeId, fileName, ret, errorCallback) {
            var url = [self.url, 'node', shockNodeId].join('/'),
                fd = new FormData();
            fd.append('file_name', fileName);
            return putRequest(url, this.token, fd);
        };

        self.loadNext = function (file, url, promise, currentChunk, chunks, incompleteId, chunkSize, ret, errorCallback, cancelCallback) {
            if (cancelCallback && cancelCallback()) {
                return;
            }
            var fileReader = new FileReader();
            fileReader.onload = function (e) {
                if (cancelCallback && cancelCallback()) {
                    return;
                }
                var fd = new FormData(),
                    oMyBlob = new Blob([e.target.result], {"type": file.type});
                fd.append(currentChunk + 1, oMyBlob);
                var lastChunk = (currentChunk + 1) * chunkSize >= file.size,
                    incomplete_attr = {
                        incomplete: (lastChunk ? "0" : "1"),
                        file_size: String(file.size),
                        file_name: file.name,
                        file_time: String(file.lastModifiedDate.getTime()),
                        chunks: String(currentChunk + 1),
                        chunk_size: String(chunkSize)
                    },
                    aFileParts = [JSON.stringify(incomplete_attr)],
                    oMyBlob2 = new Blob(aFileParts, {type: "text/json"});
                fd.append('attributes', oMyBlob2);
                $.ajax(url, {
                    contentType: false,
                    processData: false,
                    data: fd,
                    success: function (data) {
                        if (cancelCallback && cancelCallback()) {
                            return;
                        }
                        currentChunk++;
                        var uploaded_size = Math.min(file.size, currentChunk * chunkSize);
                        ret({file_size: file.size, uploaded_size: uploaded_size, node_id: incompleteId});
                        if ((currentChunk * chunkSize) >= file.size) {
                            promise.resolve();
                        } else {
                            self.loadNext(file, url, promise, currentChunk, chunks, incompleteId, chunkSize, ret, errorCallback, cancelCallback);
                        }
                    },
                    error: function (jqXHR, error) {
                        if (errorCallback) {
                            errorCallback(error);
                        }
                        promise.resolve();
                    },
                    headers: self.auth_header,
                    type: "PUT"
                });
            };
            fileReader.onerror = function () {
                if (errorCallback) {
                    errorCallback("error during upload at chunk " + currentChunk + ".");
                }
                promise.resolve();
            };

            var start = currentChunk * chunkSize;
            if (start < file.size) {
                var end = (start + chunkSize >= file.size) ? file.size : start + chunkSize;
                var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
                fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
            } else {
                ret({file_size: file.size, uploaded_size: file.size, node_id: incompleteId});
            }
        };

        /**
         * Sends to ret function callback objects like {file_size: ..., uploaded_size: ..., node_id: ...}
         * for showing progress info in UI. Parameter "shockNodeId" is optional but if you know it
         * you can resume faster.
         */
        self.upload_node = function (file, shockNodeId, searchToResume, ret, errorCallback, cancelCallback) {
            var url = self.url + '/node',
                promise = $.Deferred();
            // if this is a chunked upload, check if it needs to be resumed

            function searchForIncomplete() {
                if (searchToResume) {
                    self.check_file(file, function (incomplete) {
                        if (cancelCallback && cancelCallback())
                            return;
                        processNode(incomplete);
                    }, function (error) {
                        if (errorCallback)
                            errorCallback(error);
                        promise.resolve();
                    });
                } else {
                    processNode(null);
                }
            }

            function processNode(incomplete) {
                if (incomplete != null) {
                    var incompleteId = incomplete["id"];
                    url += "/" + incomplete["id"];
                    var currentChunk = 0;
                    if (incomplete["attributes"]["incomplete_chunks"]) {
                        currentChunk = parseInt(incomplete["attributes"]["incomplete_chunks"]);
                    } else if (incomplete["attributes"]["chunks"]) {
                        currentChunk = parseInt(incomplete["attributes"]["chunks"]);
                    }
                    var chunkSize = self.chunkSize;
                    if (incomplete["attributes"]["chunk_size"])
                        chunkSize = parseInt(incomplete["attributes"]["chunk_size"]);
                    var uploadedSize = Math.min(file.size, currentChunk * chunkSize);
                    ret({file_size: file.size, uploaded_size: uploadedSize, node_id: incompleteId});
                    self.loadNext(file, url, promise, currentChunk, chunks, incompleteId, chunkSize, ret, errorCallback, cancelCallback);
                } else {
                    var chunkSize = self.chunkSize;
                    var chunks = Math.ceil(file.size / chunkSize);
                    var incomplete_attr = {"incomplete": "1", "file_size": "" + file.size, "file_name": file.name,
                        "file_time": "" + file.lastModifiedDate.getTime(), "chunk_size": "" + chunkSize};
                    var aFileParts = [JSON.stringify(incomplete_attr)];
                    var oMyBlob = new Blob(aFileParts, {"type": "text\/json"});
                    var fd = new FormData();
                    fd.append('attributes', oMyBlob);
                    fd.append('parts', chunks);
                    jQuery.ajax(url, {
                        contentType: false,
                        processData: false,
                        data: fd,
                        success: function (data) {
                            if (cancelCallback && cancelCallback())
                                return;
                            var incompleteId = data.data.id;
                            var uploaded_size = 0;
                            ret({file_size: file.size, uploaded_size: uploaded_size, node_id: incompleteId});
                            url += "/" + data.data.id;
                            self.loadNext(file, url, promise, 0, chunks, incompleteId, chunkSize, ret, errorCallback, cancelCallback);
                        },
                        error: function (jqXHR, error) {
                            if (errorCallback)
                                errorCallback(error);
                            promise.resolve();
                        },
                        headers: self.auth_header,
                        type: "POST"
                    });
                }
            }

            if (shockNodeId) {
                self.get_node(shockNodeId, function (data) {
                    if (cancelCallback && cancelCallback())
                        return;
                    if (data &&
                        data.attributes.file_size === String(file.size) &&
                        data.attributes.file_name === file.name &&
                        data.attributes.file_time === String(file.lastModifiedDate.getTime())) {
                        processNode(data);
                    } else {
                        searchForIncomplete();
                    }
                }, function (error) {
                    searchForIncomplete();
                });
            } else {
                searchForIncomplete();
            }
            // Pray this works -- need to refactor.
            return Promise.resolve(promise);
        };

        

    }

    return ShockClient;
});
