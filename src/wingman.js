define([
	'eventemitter2',
	'common/query',
	'common/util',
	'common/frame',
	'transport'
], function (EventEmitter, query, Util, Frame, Transport) {

	"use strict";

	function Wingman (config) {

		config = config || {};
		
		this.events = new EventEmitter({ wildcard: true });

		window._xdm_name = this.name = config.name || query.name || Util.randomName();
		window._xdm_channel = this.channel = config.channel || query.channel || Util.randomName();
		this.isMiddleman = config.isMiddleman || false;

		if (Util.isIE()) {
			window._xdm_postMessage = function (message, origin) {
				window.postMessage(message, origin);
			};
		}

		var onIncoming = function (origin, target, event, payload) {
			
			if (this.isMiddleman && this.name !== target) {
				this.transport.send(origin, target, event, payload);
			}

			if (this.name !== origin && (target === '*' || this.name === target)) {
				this.events.emit(event, {
					origin: origin,
					data: payload
				});
			}
		};

		this.transport = Transport.factory({
			channel: this.channel,
			onIncoming: Util.bind(onIncoming, this)
		});

		if (!this.isMiddleman) {
			this.middlemanName = config.middlemanName || query.remoteName;
			this.middlemanLocation = config.middlemanLocation || query.remoteLocation;

			var middleman = Frame.get({
				name: this.name,
				channel: this.channel,
				remoteName: this.middlemanName,
				location: this.middlemanLocation,
				props: config.middlemanProps
			}, !query.register);

			if (!middleman) {
				throw 'Failed to create middleman';
			}

			if (config.register || query.register) {
				this.transport.addTarget(middleman, middleman.location.href);
			}
		} else {

			this.middlemanName = this.name;
			this.middlemanLocation = window.location.href;

			var origin = Frame.get({
				channel: this.channel,
				remoteName: query.remoteName,
				location: query.remoteLocation,
				isMiddleman: true
			}, false);

			if (origin) {
				this.transport.addTarget(origin, query.remoteLocation);
			}
		}
	}

	Wingman.prototype.emit = function(target, event, payload) {
		this.transport.send(this.name, target, event, payload);
	};

	Wingman.prototype.subscribe = function(origin, event, cb) {
		this.events.on(event, function (payload) {
			if (origin === '*' || payload.origin === origin) {
				cb(payload.origin, this.event, payload.data);
			}
		});
	};

	Wingman.prototype.openWindow = function(name, url, options) {
		
		url = Util.appendQueryParameters(url, {
            xdm_c: this.channel,
            xdm_n: name,
            xdm_rn: this.middlemanName,
            xdm_rl: this.middlemanLocation,
            xdm_r: 1
        });

        options = options || {};

        var target = options.target || '_blank';
        delete options.target;

        var attributes = [];
        for (var prop in options) { if (options.hasOwnProperty(prop)) {
                attributes.push(prop + '=' + options[prop]);
            }
        }
        attributes = attributes.join(', ');

        return window.open(url, target, attributes);
	};

	window.Wingman = Wingman;
	return Wingman;
});