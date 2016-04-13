/*global define*/
/*jslint white:true,browser:true*/
/*
 * Message Bus
 * A simple pub/sub message bus. Designed to be light and instantiated for domain
 * specific usage. In other words, not designed to be an app wide message bus 
 * with namespacing via channels, etc.
 */
define([
], function () {
    function factory(config) {
        'use strict';
        var subscriptions = {},
            published = [],
            timer;

        function processPublished() {
            var processing = published;
            published = [];
            processing.forEach(function (item) {
                var messageName = item.name,
                    handlers = subscriptions[messageName],
                    newHandlers = [];
                if (handlers) {
                    handlers.forEach(function (handler) {
                        try {
                            var result = handler.handler(item.data);
                            if (item.envelope) {
                                if (item.envelope.reply) {
                                    publish(item.envelope.reply, result);
                                }
                            }
                        } catch (ex) {
                            console.error('ERROR');
                            console.error(ex);
                        } finally {
                            if (!handler.once) {
                                newHandlers.push(handler);
                            }
                        }
                    });
                    subscriptions[messageName] = newHandlers;
                }
            });

        }
        function start() {
            if (timer) {
                return;
            }
            timer = window.setTimeout(function () {
                timer = null;
                processPublished();
            }, 0);
        }

        // API
        function subscribe(name, handler, once) {
            if (!subscriptions[name]) {
                subscriptions[name] = [];
            }
            var subscription = subscriptions[name];
            subscription.push({
                handler: handler,
                once: once
            });
        }

        function publish(name, data, envelope) {
            published.push({
                name: name,
                data: data,
                envelope: envelope
            });
            start();
        }

        return {
            subscribe: subscribe,
            publish: publish
        };
    }
    
    return {
        make: function (config) {
            return factory(config);
        }
    };
});