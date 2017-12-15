/**
 * stat  receive agent client monitor data
 * merger vaild data that has response
 * when server  restart, it will clear
 *
 *
 */

let _timeDataMap = {};
let _countDataMap = {};

const stat = module.exports;

stat.getTimeData = function () {
    return _timeDataMap;
};

stat.getCountData = function () {
    return _countDataMap;
};

/**
 * clear data
 */
stat.clear = function (agent) {
    if (!!agent) {
        delete _timeDataMap[agent];
        delete _countDataMap[agent];
    } else {
        _timeDataMap = {};
        _countDataMap = {};
    }
};

stat.merge = function (agent, message) {
    _timeDataMap[agent] = message.timeData;
    _countDataMap[agent] = message.incrData;
};
