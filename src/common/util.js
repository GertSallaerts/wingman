define([], function () {

    "use strict";

    // returns groups for protocol (2), domain (3) and port (4)
    var reURI = /^((http.?:)\/\/([^:\/\s]+)(:\d+)*)/;
    // matches a foo/../ expression
    var reParent = /[\-\w]+\/\.\.\//;
    // matches `//` anywhere but in the protocol
    var reDoubleSlash = /([^:])\/\//g;

    var channelId = Math.floor(Math.random() * 10000);

    var addEvent = (function () {
        if (window.addEventListener) {
            return function (target, type, listener) {
                target.addEventListener(type, listener, false);
            };
        }
        return function (target, type, listener) {
            target.attachEvent('on' + type, listener);
        };
    }());

    var removeEvent = (function () {
        if (window.removeEventListener) {
            return function (target, type, listener) {
                target.removeEventListener(type, listener, false);
            };
        }
        return function (target, type, listener) {
            target.detachEvent('on' + type, listener);
        };
    }());

    var isIE = (function () {
        var _isIE;

        return function () {
            if (typeof _isIE === 'undefined') {
                var rv = -1, // Return value assumes failure.
                    ua = navigator.userAgent,
                    re;
                
                if (navigator.appName === 'Microsoft Internet Explorer') {
                    re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
                    
                    if (re.exec(ua) !== null)
                        rv = parseFloat(RegExp.$1);
                }
                    
                // IE > 11
                else if (ua.indexOf("Trident") > -1) {
                    re = new RegExp("rv:([0-9]{2,2}[\.0-9]{0,})");
                    if (re.exec(ua) !== null) {
                        rv = parseFloat(RegExp.$1);
                    }
                }

                _isIE = rv >= 8;
            }

            return _isIE;
        };
    })();

    /**
     * Helper for testing if an object is an array
     *
     * @param {Object} obj The object to test
     * @return {Boolean}
     */

    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }

    function inArray (el, arr) {
        var item = '';
        
        for (item in arr) {
            if (arr[item] === el) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Returns a string containing the schema, domain and if present the port
     *
     * @param {String} url The url to extract the location from
     * @return {String} The location part of the url
     */

    function getLocation(url) {
        if (!url) {
            throw new Error('url is undefined or empty');
        }
        if (/^file/.test(url)) {
            throw new Error('The file:// protocol is not supported');
        }

        var m = url.toLowerCase().match(reURI);
        if (m) {
            var proto = m[2], domain = m[3], port = m[4] || '';
            if ((proto === 'http:' && port === ':80') || (proto === 'https:' && port === ':443')) {
                port = '';
            }
            return proto + '//' + domain + port;
        }

        return url;
    }

    /**
     * Applies properties from the source object to the target object.
     *
     * @param {Object} destination The target of the properties.
     * @param {Object} source The source of the properties.
     * @param {Boolean} noOverwrite Set to True to only set non-existing properties.
     */

    function merge(destination, source, noOverwrite) {
        var member;
        for (var prop in source) {
            if (source.hasOwnProperty(prop)) {
                if (prop in destination) {
                    member = source[prop];
                    if (typeof member === 'object') {
                        merge(destination[prop], member, noOverwrite);
                    }
                    else if (!noOverwrite) {
                        destination[prop] = source[prop];
                    }
                }
                else {
                    destination[prop] = source[prop];
                }
            }
        }
        return destination;
    }

    /**
     * HOST ONLY
     * Appends the parameters to the given url.
     * The base url can contain existing query parameters.
     *
     * @param {String} url The base url.
     * @param {Object} parameters The parameters to add.
     * @return {String} A new valid url with the parameters appended.
     */

    function appendQueryParameters(url, parameters) {
        if (!parameters) {
            throw new Error('parameters is undefined or null');
        }

        var indexOf = url.indexOf('#');
        var q = [];
        for (var key in parameters) {
            if (parameters.hasOwnProperty(key)) {
                q.push(key + '=' + encodeURIComponent(parameters[key]));
            }
        }

        return url + (indexOf === -1 ? '#' : '&') + q.join('&');
    }

    function randomName() {
        return 'random-' + (++channelId);
    }

    function bind (fn, ctx) {
        if (typeof fn !== 'function') {
            // closest thing possible to the ECMAScript 5
            // internal IsCallable function
            throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
        }

        var aArgs   = Array.prototype.slice.call(arguments, 2),
            fToBind = fn,
            FNOP    = function() {},
            fBound  = function() {
                return fToBind.apply(
                    fn instanceof FNOP && ctx ? fn : ctx,
                    aArgs.concat(Array.prototype.slice.call(arguments))
                );
            };

        FNOP.prototype = fn.prototype;
        fBound.prototype = new FNOP();

        return fBound;
    }

    return {
        addEvent: addEvent,
        removeEvent: removeEvent,
        isIE: isIE,
        isArray: isArray,
        inArray: inArray,
        getLocation: getLocation,
        merge: merge,
        appendQueryParameters: appendQueryParameters,
        randomName: randomName,
        bind: bind
    };
});
