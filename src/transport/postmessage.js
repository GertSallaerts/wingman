define(['common/util', 'common/frame'], function (Util, Frame) {

    "use strict";

    function PostMessage (config) {
        this._targets = [];
        this._targetOrigins = [];
        this._channel = config.channel;
    }

    function parseRegister (channel, message) {
        var payload = JSON.parse(message);

        return {
            target: Frame.get({
                channel: channel,
                remoteName: payload.name,
                location: payload.location
            }, false),
            targetLocation: Util.getLocation(payload.location)
        };
    }

    PostMessage.prototype.incoming = function(event) {
        var message = event.data,
            origin = Util.getLocation(event.origin),
            source = event.source,

            originOk = Util.inArray(origin, this._targetOrigins),
            isString = typeof message === 'string',
            messageOk = isString && message.substring(0, this._channel.length + 1) === this._channel + ' ',
            registerOk = isString && message.substring(0, this._channel.length + 9) === this._channel + '-register';

        if (registerOk) {
            // if (Util.isIE()) {
            //     var fromTarget = parseRegister(this._channel, message.substring(this._channel.length + 10));
            //     source = fromTarget.target;
            //     origin = fromTarget.targetLocation;
            // }

            this.addTarget(source, origin, true);
        } else if (originOk && messageOk) {
            this.up.incoming(message.substring(this._channel.length + 1), origin);
        }
    };

    PostMessage.prototype.outgoing = function(message, domain) {
        for (var t in this._targets) { if (this._targets.hasOwnProperty(t)) {
                this._post(this._targets[t], this._channel + ' ' + message, domain || this._targetOrigins[t]);
            }
        }
    };

    PostMessage.prototype.addTarget = function(target, targetLocation, reverse) {

        try {

            if (typeof target !== 'object' || !('document' in target))
                throw 'Target needs to be a window';

            target = !target.postMessage ? !target.document.postMessage ? false : target.document : target;

            if (!target)
                throw 'postMessage not found on target';
        } catch (e) { }

        this._targets.push(target);
        this._targetOrigins.push(Util.getLocation(targetLocation || target.location.href));

        if (reverse) {
            this.up.addTarget(target, targetLocation, reverse);
        } else {
            var channel = this._channel,
                payload = JSON.stringify({
                    name: window._xdm_name,
                    location: window.location.href
                });

            try {
                this._post(target, channel + '-register ' + payload, targetLocation);
            } catch (e) {
                Util.addEvent(target, 'load', function (e) {
                    this._post(target, channel + '-register ' + payload, targetLocation);
                });
            }
        }
    };

    PostMessage.prototype._post = function(target, message, origin) {
        try {
            target.postMessage(message, origin);
        } catch (e) {
            if (Util.isIE()) {
                target._xdm_postMessage(message, origin);
            }
        }
    };

    PostMessage.prototype.init = function() {

        var self = this;

        Util.addEvent(window, 'message', function (e) {
            self.incoming(e);
        });
    };

    return PostMessage;
});