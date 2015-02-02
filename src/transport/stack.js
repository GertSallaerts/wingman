define(['common/util'], function (Util) {

	"use strict";

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