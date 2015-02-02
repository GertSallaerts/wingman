define(['common/util'], function (Util) {

	"use strict";

    function _find(container, location, channel, name) {
        location = Util.getLocation(location);
        for (var i = container.length - 1; i >= 0; i--) {
            var frame = container[i];
            try {
                var locationOk = location === Util.getLocation(frame.location.href),
                    channelOk = channel === frame._xdm_channel,
                    nameOk = name === frame._xdm_name;

                if (locationOk && channelOk && nameOk)
                    return frame;
            } catch (e) { }
        }

        return;
    }

    function get (config, create) {

        create = create !== false ? true : false;

        var frame;

        if (config.isMiddleman) {
            return window.parent;
        }
        
        if (!frame) {
            frame = _find(window.frames, config.location, config.channel, config.remoteName);
        }

        if (window.opener && !frame) {
            frame = _find([ window.opener ], config.location, config.channel, config.remoteName);
        }

        if (window.opener && !frame) {
            frame = _find(window.opener.frames, config.location, config.channel, config.remoteName);
        }

        if (!frame && create) {
            frame = make(config);
        }

        return frame ? 'contentWindow' in frame ? frame.contentWindow : frame : null;
    }

    function make (config) {
        config.props = config.props || {};
        
        var frame = document.createElement('IFRAME'),
            container = config.container || document.body;

        // merge the defaults with the configuration properties
        Util.merge(config.props, {
            frameBorder: 0,
            allowTransparency: true,
            scrolling: 'no',
            width: '100%',
            src: Util.appendQueryParameters(config.location, {
                xdm_c: config.channel,
                xdm_n: config.remoteName,
                xdm_rn: config.name,
                xdm_rl: Util.getLocation(location.href)
            }),
            _xdm_name: config.remoteName,
            _xdm_channel: config.channel,

            style: {
                margin: 0,
                padding: 0,
                border: 0
            }
        }, true);
    
        Util.merge(frame, config.props);
        container.appendChild(frame);

        return frame;
    }

	return {
		get: get,
		make: make
	};
});