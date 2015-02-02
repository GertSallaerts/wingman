define(['common/util'], function (Util) {

    "use strict";
    
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