/*global define,require*/
/*jslint white:true,browser:true */

define([
    'kb_widget/runtimeManager'
], function (RuntimeManager) {
    'use strict';

    function factory(config) {
        var url = config.url,
            cdnUrl = config.cdn,
            runtimeManager = RuntimeManager.make({
                cdnUrl: cdnUrl
            });

        var widgetPackages = [
            {
                name: 'widgets',
                versions: [
                    {
                        version: '0.1.0',
                        config: {
                            runtime: {
                                version: '0.1.1'
                            }
                        },
                        widgets: [
                            {
                                widgetName: 'test',
                                fileName: 'testWidget.js',
                                amdName: 'testWidget',
                                // inputs are named properties, with optional type and required flag
                                input: {
                                    objectRef: {
                                        required: true,
                                        type: '??'
                                    }
                                }
                            },
                            {
                                widgetName: 'pairedEndLibrary',
                                fileName: 'pairedEndLibrary.js',
                                amdName: 'pairedEndLibrary',
                                input: {
                                    objectRef: {
                                        required: true
                                    }
                                }
                            },
                            {
                                widgetName: 'contigSet',
                                fileName: 'contigSet.js',
                                amdName: 'contigSet',
                                input: {
                                    objectRef: {
                                        required: true
                                    }
                                }
                            },
                            {
                                widgetName: 'genomeComparison',
                                fileName: 'genomeCompairson.js',
                                amdName: 'genomeComparison',
                                input: {
                                    objectRef: {
                                        required: true
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        ];
        
        var widgetDb = {};
        widgetPackages.forEach(function (widgetPackage) {
            widgetDb[widgetPackage.name] = {};
            widgetPackage.versions.forEach(function(version) {
                widgetDb[widgetPackage.name][version.version] = {
                    config: version.config,
                    widgets: {}
                };
                version.widgets.forEach(function (widget) {
                    widgetDb[widgetPackage.name][version.version].widgets[widget.widgetName] = widget;
                });
            });
        });

        function findPackage(packageName, version) {
            var widgetPackage = widgetDb[packageName];
            if (!widgetPackage) {
                throw new Error('Cannot locate package ' + packageName);
            }
            var versionedPackage = widgetPackage[version];
            if (!versionedPackage) {
                throw new Error('Cannot locate version ' + version + ' for package ' + packageName);
            }

            return versionedPackage;
        }

        /*
         * Get a specific widget
         */
        function getWidget(packageName, version, widgetName) {
            var versionedPackage = findPackage(packageName, version),
                widget = versionedPackage.widgets[widgetName];
            
            if (!widget) {
                throw new Error('Cannot locate widget ' + widgetName + ' in package ' + packageName + ' version ' + version);
            }

            return {
                widget: widget,
                packageName: packageName,
                packageVersion: version
            };
        }
        
        /*
         * Find a widget with certain constraints.
         * Currently finds the most recent widget
         */
        function findWidget(findWidgetName) {
            var i, j, k, widgetPackage, version, widget;
            for (i = 0; i < widgetPackages.length; i += 1) {
                widgetPackage = widgetPackages[i];
                for (j = 0; j < widgetPackage.versions.length; j += 1) {
                    version = widgetPackage.versions[j];
                    for (k = 0; k < version.widgets.length; k += 1) {
                        widget = version.widgets[k];
                        if (widget.widgetName === findWidgetName) {
                            return {
                                packageName: widgetPackage.name,
                                packageVersion: version.version,
                                widget: widget
                            };
                        }
                    }
                }
                
            }
        }

        function getRuntime(widgetDef) {
            var widgetPackage = findPackage(widgetDef.packageName, widgetDef.packageVersion),
                widgetRuntime = runtimeManager.getRuntime(widgetPackage.config.runtime.version);
            return widgetRuntime;
        }
        
        function getBaseUrl(widgetDef) {
            return [url, widgetDef.packageName, widgetDef.packageVersion].join('/');
        }

        function getModuleLoader(widgetDef) {
            var widgetRuntime = getRuntime(widgetDef);
            return require.config({
                context: 'widget_runtime_' + widgetRuntime.version,
                baseUrl: getBaseUrl(widgetDef),
                paths: widgetRuntime.amd.paths,
                shim: widgetRuntime.amd.shim
            });
        }

        return {
            getBaseUrl: getBaseUrl,
            getWidget: getWidget,
            getModuleLoader: getModuleLoader,
            findWidget: findWidget
        };
    }
    
    return {
        make: function (config) {
            return factory(config);
        }
    };
});