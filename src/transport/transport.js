define([
    'transports/stack',
    'transports/postmessage'
], function (Stack, PostmessageTransport) {

	"use strict";

    function Transport (stack) {
        this.stack = stack;
        this.stack.init();
    }

    Transport.factory = function (options) {
        options = options || {};

        var channel = options.channel || null,
            incomingWrap = function (fn) {
                return function (message, origin) {
                    var data = JSON.parse(message);
                    fn(data.origin, data.target, data.event, data.payload);
                };
            },
            onIncoming = options.onIncoming ? incomingWrap(options.onIncoming) : function () {},
            stackElements = [];

        stackElements.push(new PostmessageTransport({ channel: channel }));
        stackElements.push({ incoming: onIncoming });

        return new Transport(new Stack(stackElements));
    };

    Transport.prototype.send = function(origin, target, event, payload) {

        var message = JSON.stringify({
            origin: origin,
            target: target,
            event: event,
            payload: payload
        });

        this.stack.outgoing(message);
    };

    Transport.prototype.addTarget = function(frame, frameLocation) {
        this.stack.addTarget(frame, frameLocation);
    };

	return Transport;
});