define([
    'bluebird',
    'kb/common/utils',
    './utils',
    './client/workspace',
    './client/userProfile',
    './client/narrativeMethodStore'
],
    function (Promise, Utils, APIUtils, Workspace, UserProfile, NarrativeMethodStore) {

        function factory(config) {
            var runtime = config.runtime,
                workspaceClient = new Workspace(runtime.getConfig('services.workspace.url'), {
                    token: runtime.getService('session').getAuthToken()
                }),
                userProfileClient = new UserProfile(runtime.getConfig('services.user_profile.url'), {
                    token: runtime.getService('session').getAuthToken()
                }),
                narrativeMethodStoreClient = new NarrativeMethodStore(runtime.getConfig('services.narrative_method_store.url'), {
                    token: runtime.getService('session').getAuthToken()
                });
            function isValidNarrative(workspaceObject) {
                if (workspaceObject.metadata.narrative &&
                    // corrupt workspaces may have narrative set to something other than the object id of the narrative
                    /^\d+$/.test(workspaceObject.metadata.narrative) &&
                    workspaceObject.metadata.is_temporary !== 'true') {
                    return true;
                } else {
                    return false;
                }
            }
            function applyNarrativeFilter(ws, filter) {
                return true;
            }
            function parseMethodId(id) {
                var parts = id.split(/\//).filter(function (part) {
                    if (part.length > 0) {
                        return true;
                    }
                }), method;
                if (parts.length === 1) {
                    // legacy method
                    method = {
                        id: parts[0]
                    };
                } else if (parts.length === 3) {
                    method = {
                        module: parts[0],
                        id: parts[1],
                        commitHash: parts[2]
                    };
                } else if (parts.length === 2) {
                    method = {
                        module: parts[0],
                        id: parts[1]
                    };
                } else {
                    console.error('ERROR');
                    console.error('parts');
                    throw new Error('Invalid method metadata');
                }
                return method;
            }
            function getNarratives(cfg) {
                // get all the narratives the user can see.
                return workspaceClient.list_workspace_info(cfg.params)
                    .then(function (data) {
                        var workspaces = [], i, wsInfo;
                        for (i = 0; i < data.length; i += 1) {
                            wsInfo = APIUtils.workspaceInfoToObject(data[i]);
                            if (isValidNarrative(wsInfo) && applyNarrativeFilter(cfg.filter)) {
                                workspaces.push(wsInfo);
                            }
                        }

                        var objectRefs = workspaces.map(function (w) {
                            return {
                                ref: w.id + '/' + w.metadata.narrative
                            };
                        });

                        if (objectRefs.length === 0) {
                            return [workspaces, []];
                        }

                        // Now get the corresponding object metadata for each narrative workspace
                        return [workspaces, workspaceClient.get_object_info_new({
                                objects: objectRefs,
                                ignoreErrors: 1,
                                includeMetadata: 1
                            })];
                    })
                    .spread(function (workspaces, data) {
                        var narratives = [], i, apps, methods;
                        for (i = 0; i < data.length; i += 1) {
                            // If one of the object ids from the workspace metadata (.narrative) did not actually
                            // result in a hit, skip it. This can occur if a narrative is corrupt -- the narrative object
                            // was deleted or replaced and the workspace metadata not updated.
                            if (!data[i]) {
                                //console.log('WARNING: workspace ' + object.wsid + ' does not contain a matching narrative object');
                                continue;
                            }
                            // Make sure it is a valid narrative object.
                            var object = APIUtils.object_info_to_object(data[i]);
                            if (object.typeName !== 'Narrative') {
                                continue;
                            }

                            if (object.metadata) {

                                // Convert some narrative-specific metadata properties.
                                if (object.metadata.job_info) {
                                    object.metadata.jobInfo = JSON.parse(object.metadata.job_info);
                                }
                                if (object.metadata.methods) {
                                    object.metadata.cellInfo = JSON.parse(object.metadata.methods);
                                }

                                apps = [];
                                methods = [];

                                /* Old narrative apps and method are stored in the cell info.
                                 * metadata: {
                                 *    methods: {
                                 *       app: {
                                 *          myapp: 1,
                                 *          myapp2: 1
                                 *       },
                                 *       method: {
                                 *          mymethod: 1,
                                 *          mymethod2: 1
                                 *       }
                                 *    }
                                 * }
                                 */
                                if (object.metadata.cellInfo) {
                                    if (object.metadata.cellInfo.app) {
                                        Object.keys(object.metadata.cellInfo.app).forEach(function (key) {
                                            apps.push(parseMethodId(key));
                                        });
                                    }
                                    if (object.metadata.cellInfo.method) {
                                        Object.keys(object.metadata.cellInfo.method).forEach(function (key) {
                                            methods.push(parseMethodId(key));
                                        });
                                    }
                                }

                                /* New narrative metadata is stored as a flat set of
                                 * metdata: {
                                 *    app.myapp: 1,
                                 *    app.myotherapp: 1,
                                 *    method.my_method: 1,
                                 *    method.my_other_method: 1
                                 * }
                                 */
                                Object.keys(object.metadata).forEach(function (key) {
                                    var keyParts = key.split('.');
                                    switch (keyParts[0]) {
                                    case 'app':
                                        apps.push(parseMethodId(keyParts[1]));
                                        break;
                                    case 'method':
                                        var method = parseMethodId(keyParts[1]);
                                        // methods.push(keyParts[1]);
                                        method.source = 'new';
                                        methods.push(method);
                                        break;
                                    }
                                });
                            }


                            narratives.push({
                                workspace: workspaces[i],
                                object: object,
                                apps: apps,
                                methods: methods
                            });
                        }
                        return(narratives);
                    });
            }
            function getPermissions(narratives) {
                return Promise.try(function () {
                    if (narratives.length === 0) {
                        return [];
                    }
                    var permParams = narratives.map(function (narrative) {
                        return {
                            id: narrative.workspace.id
                        };
                    }),
                        username = runtime.service('session').getUsername();
                    return workspaceClient.get_permissions_mass({
                        workspaces: permParams
                    })
                        .then(function (result) {
                            var permissions = result.perms;
                            for (var i = 0; i < permissions.length; i++) {
                                var narrative = narratives[i];
                                narrative.permissions = Utils.object_to_array(permissions[i], 'username', 'permission')
                                    .filter(function (x) {
                                        if (x.username === username ||
                                            x.username === '*' ||
                                            x.username === narrative.workspace.owner) {
                                            return false;
                                        } else {
                                            return true;
                                        }
                                    })
                                    .sort(function (a, b) {
                                        if (a.username < b.username) {
                                            return -1;
                                        } else if (a.username > b.username) {
                                            return 1;
                                        }
                                        return 0;
                                    });
                            }
                            return narratives;
                        });
                });
            }
            function getApps() {
                return narrativeMethodStoreClient.list_apps({});
            }
            function getMethods() {
                return narrativeMethodStoreClient.list_methods({});
            }
            function getCollaborators(options) {
                var users = (options && options.users) ? options.users : [];
                users.push(runtime.getService('session').getUsername());
                return getNarratives({
                    params: {
                        excludeGlobal: 1
                    }
                })
                    .then(function (narratives) {
                        return getPermissions(narratives);
                    })
                    .then(function (narratives) {
                        var collaborators = {}, i, perms, pass;

                        for (i = 0; i < narratives.length; i += 1) {
                            // make sure logged in user is here
                            // make sure subject user is here
                            // I hate this crud, but there ain't no generic array search.
                            perms = narratives[i].permissions;

                            // make sure all users are either owner or in the permissions list.
                            pass = true;
                            if (_.some(users, function (user) {
                                if (narratives[i].workspace.owner === user ||
                                    _.find(perms, function (x) {
                                        return x.username === user;
                                    })) {
                                    return false;
                                } else {
                                    return true;
                                }
                            })) {
                                continue;
                            }

                            // Remove participants and the public user.
                            var filtered = perms.filter(function (x) {
                                if (_.contains(users, x.username) ||
                                    x.username === '*') {
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            // And what is left are all the users who are collaborating on this same narrative.
                            // okay, now we have a list of all OTHER people sharing in this narrative.
                            // All of these folks are common collaborators.
                            filtered.forEach(function (x) {
                                Utils.incrProp(collaborators, x.username)
                            });
                        }
                        var collabs = Utils.object_to_array(collaborators, 'username', 'count');
                        var usersToFetch = collabs.map(function (x) {
                            return x.username
                        });
                        return [collabs, usersToFetch, userProfileClient.get_user_profile(usersToFetch)];
                    })
                    .spread(function (collabs, usersToFetch, data) {
                        var i;
                        for (i = 0; i < data.length; i += 1) {
                            // it is possible that a newly registered user, not even having a stub profile,
                            // are in this list?? If so, remove that user from the network.
                            // TODO: we need a way to report these cases -- they should not occur or be very rare.
                            if (!data[i] || !data[i].user) {
                                console.log('WARNING: user ' + usersToFetch[i] + ' is a sharing partner but has no profile.');
                            } else {
                                collabs[i].realname = data[i].user.realname;
                            }
                        }
                        collabs = collabs.filter(function (x) {
                            return (x.realname ? true : false);
                        });
                        return collabs;
                    });
            }

            return {
                getNarratives: getNarratives,
                getCollaborators: getCollaborators,
                getPermissions: getPermissions,
                getApps: getApps,
                getMethods: getMethods
            };
        }

        return {
            make: function (config) {
                return factory(config);
            }
        };
    });
