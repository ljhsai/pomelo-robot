const Agent = require('./agent/agent').Agent;
const Server = require('./master/server').Server;
const HTTP_SERVER = require('./web/http').HTTP_SERVER;
/**
 * export to developer prototype
 *
 * @param {Object} config
 * include deal with master and agent mode
 *
 * param include mode
 *
 */
const Robot = function (conf) {
    this.conf = conf;
    this.master = null;
    this.agent = null;
};

/*
 * run master server
 *
 * @param {String} start up file
 *
 */
Robot.prototype.runMaster = function (mainFile) {
    let conf = {};
    conf.clients = this.conf.clients;
    conf.mainFile = mainFile;
    this.master = new Server(conf);
    this.master.listen(this.conf.master.port);
    HTTP_SERVER.start(this.conf.master.webport);
};

/**
 * run agent client
 *
 * @param {String} script
 *
 */
Robot.prototype.runAgent = function (scriptFile) {
    let conf = {
        master: this.conf.master,
        apps: this.conf.apps,
        scriptFile: scriptFile,
    };
    this.agent = new Agent(conf);
    this.agent.start();
};

Robot.prototype.restart = function () {
    if (this.agent != null) {
        this.agent.reconnect(true);
    }
}

exports.Robot = Robot;

