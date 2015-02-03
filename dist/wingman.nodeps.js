(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['eventemitter2'], factory);
    } else {
        // Browser globals
        root.Wingman = factory(root.EventEmitter2);
    }
}(this, function (EventEmitter2) {/**
 * @license almond 0.3.0 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("node_modules/almond/almond", function(){});

/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define('eventemitter2',[],function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

define('common/util',[], function () {

    

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

define('common/query',['common/util'], function (Util) {

    
    
    /**
     * Build the query object from location.hash
     */
    return (function (input) {
        input = input.substring(1, input.length).split('&');
        var data = {}, pair, key, value, i = input.length;
        while (i--) {
            pair = input[i].split('=');
            key = pair[0];
            value = decodeURIComponent(pair[1]);

            switch (key) {
                case 'xdm_c':
                    data.channel = value;
                    break;
                case 'xdm_n':
                    data.name = value;
                    break;
                case 'xdm_rn':
                    data.remoteName = value;
                    break;
                case 'xdm_rl':
                    data.remoteLocation = value;
                    break;
                case 'xdm_r':
                    data.register = value ? true : false;
                    break;
            }
        }
        return data;
    }(location.hash));
});
define('common/frame',['common/util'], function (Util) {

	

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
define('transports/stack',['common/util'], function (Util) {

	

    var defaults = {
        incoming: function (message, origin) {
            if (this.up) this.up.incoming(message, origin);
        },
        outgoing: function (message, recipient) {
            if (this.down) this.down.outgoing(message, recipient);
        },
        addTarget: function (target, targetLocation, reverse) {
            if (reverse && this.up) this.up.addTarget(target, targetLocation, reverse);
            else if (!reverse && this.down) this.down.addTarget(target, targetLocation, reverse);
        },
        callback: function (success) {
            if (this.up) this.up.callback(success);
        },
        init: function () {
            if (this.down) this.down.init();
        },
        destroy: function () {
            if (this.down) this.down.destroy();
        },
    };

	function Stack (elements) {

        var element, i, len = elements.length;

        for (i = 0; i < len; i++) {
            element = elements[i];
            Util.merge(element, defaults, true);

            if (i !== 0) {
                element.down = elements[i - 1];
            }

            if (i !== len - 1) {
                element.up = elements[i + 1];
            }
        }

        return element;
		
	}

    /**
     * This will remove a stackelement from its stack while leaving the stack functional.
     *
     * @param {Object} element The elment to remove from the stack.
     */

    Stack.remove = function (element) {
        element.up.down = element.down;
        element.down.up = element.up;
        element.up = element.down = null;
    };

	return Stack;
});
define('transports/postmessage',['common/util', 'common/frame'], function (Util, Frame) {

    

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
                try {
                    target._xdm_postMessage(message, origin);
                } catch (e2) { }
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
define('transport',[
    'transports/stack',
    'transports/postmessage'
], function (Stack, PostmessageTransport) {

	

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
define('wingman',[
	'eventemitter2',
	'common/query',
	'common/util',
	'common/frame',
	'transport'
], function (EventEmitter, query, Util, Frame, Transport) {

	

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
    //Register in the values from the outer closure for common dependencies
    //as local almond modules
    define('eventemitter2', function () {
        return EventEmitter2;
    });

    //Use almond's special top-level, synchronous require to trigger factory
    //functions, get the final module value, and export it as the public
    //value.
    return require('wingman');
}));