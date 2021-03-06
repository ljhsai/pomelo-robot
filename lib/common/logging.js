/* Generic logging module.
 *
 * Log Levels:
 * - 3 (Debug)
 * - 2 (Info)
 * - 1 (Warn)
 * - 0 (Error)
 */

const Logger = function (log_level) {
    this._log_level = log_level ? log_level : 2;
};

Logger.prototype = {
    _timestamp: function (msg) {
        return (new Date()).toLocaleString().slice(0, 24);
    },
    set: function (level) {
        this._log_level = level;
    },
    debug: function (msg) {
        if (this._log_level < 3) {
            return;
        }
        console.info("[" + this._timestamp() + "] DEBUG: " + msg);
    },

    isDebug: function (msg) {
        if (this._log_level < 3) {
            return false;
        } else {
            return true;
        }
    },

    info: function (msg) {
        if (this._log_level < 2) {
            return;
        }
        console.info("[" + this._timestamp() + "] INFO: " + msg);
    },

    warn: function (msg) {
        if (this._log_level < 1) {
            return;
        }
        console.warn("[" + this._timestamp() + "] WARN: " + msg);
    },

    error: function (msg) {
        if (this._log_level < 0) {
            return;
        }
        console.error("[" + this._timestamp() + "] ERROR: " + msg);
    }
};

let instance = new Logger();

getLogger = function () {
    return instance();
};

exports.Logger = instance;
