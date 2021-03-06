const _ = require('underscore');
const io = require('socket.io-client');
const logging = require('../common/logging').Logger;
const Actor = require('./actor').Actor;
const monitor = require('../monitor/monitor');
const util = require('../common/util');

const STATUS_INTERVAL = 10 * 1000; // 10 seconds
const RECONNECT_INTERVAL = 10 * 1000; // 15 seconds
const HEARTBEAT_PERIOD = 30 * 1000; // 30 seconds
const HEARTBEAT_FAILS = 3; // Reconnect after 3 missed heartbeats

/**
 *
 * @param {Object} conf
 * init the master and app server for the agent
 * include app data, exec script,etc.
 *
 */
const Agent = function (conf) {
    this.log = logging;
    this.conf = conf || {};
    this.last_heartbeat = null;
    this.connected = false;
    this.reconnecting = false;
    this.actors = {};
    this.count = 0;
};

Agent.prototype = {
    // Create socket, bind callbacks, connect to server
    connect() {
        let uri = "ws://" + this.conf.master.host + ":" + this.conf.master.port;
        console.log("uri", uri);
        this.socket = io.connect(uri);
        // this.socket = io.connect(uri, {'force new connection': true, 'try multiple transports': false});
        this.socket.on('error', (reason) => this.reconnect());
        // Register announcement callback
        this.socket.on('connect', () => {
            this.log.info("Connected to server, sending announcement...");
            //web.log(this.socket.socket.sessionid);
            //web.log(require('util').inspect(this.socket.address,true,10,10));
            this.announce(this.socket);
            this.connected = true;
            this.reconnecting = false;
            this.last_heartbeat = new Date().getTime();
        });

        this.socket.on('disconnect', () => {
            // this.socket.disconnect();
            this.log.error("Disconnect...");
        });
        // Server heartbeat
        this.socket.on('heartbeat', () => {
            //this.log.info("Received server heartbeat");
            this.last_heartbeat = new Date().getTime();
        });

        // Node with same label already exists on server, kill process
        this.socket.on('node_already_exists', () => {
            this.log.error("ERROR: A node of the same name is already registered");
            this.log.error("with the log server. Change this this's instance_name.");
            this.log.error("Exiting.");
            process.exit(1);
        });

        //begin to run
        this.socket.on('run', (message) => this.run(message));

        // Exit for BTN_ReReady
        this.socket.on('exit4reready', () => {
            this.log.info("Exit for BTN_ReReady.");
            process.exit(0);
        });
    },

    run(msg) {
        util.deleteLog();
        this.count = msg.maxuser;
        let script = msg.script;
        let index = msg.index;
        if (!!script && script.length > 1) {
            this.conf.script = script;
        }
        this.log.info(this.nodeId + ' run ' + this.count + ' actors ');
        monitor.clear();
        this.actors = {};
        let offset = index * this.count;
        let self = this;
        for (let i = 0; i < this.count; i++) {
            let aid = i + offset; //calc database key offset;
            let actor = new Actor(this.conf, aid);
            this.actors[aid] = actor;
            (function (actor) {
                actor.on('error', (error) => self.socket.emit('error', error));
                console.log("time==>", self.conf.master.interval)
                if (self.conf.master.interval <= 0) {
                    actor.run();
                } else {
                    let time = Math.round(Math.random() * 1000 + i * self.conf.master.interval);
                    console.log("ks time==>", time);
                    setTimeout(() => actor.run(), time);
                }
            })(actor);

        }

        if (this.reportTimeId) {
            clearInterval(this.reportTimeId);
        }

        this.reportTimeId = setInterval(() => {
            let mdata = monitor.getData();
            this.socket.emit('report', mdata);
        }, STATUS_INTERVAL);
    },

    // Run agent
    start() {
        this.connect();
        // Check for heartbeat every HEARTBEAT_PERIOD, reconnect if necessary
        setInterval(() => {
            let delta = ((new Date().getTime()) - this.last_heartbeat);
            if (delta > (HEARTBEAT_PERIOD * HEARTBEAT_FAILS)) {
                this.log.warn("Failed heartbeat check, reconnecting...");
                this.connected = false;
                this.reconnect();
            }
        }, HEARTBEAT_PERIOD);
    },

    // Sends announcement 
    announce(socket) {
        let sessionid = this.socket.id;
        this.nodeId = sessionid;
        this._send('announce_node', {
            client_type: 'node',
            nodeId: sessionid
        });
    },

    // Reconnect helper, retry until connection established
    reconnect(force) {
        if (!force && this.reconnecting) {
            return;
        }
        this.reconnecting = true;
        if (this.socket != null) {
            this.socket.disconnect();
            this.connected = false;
        }
        this.log.info("Reconnecting to server...");
        setTimeout(function () {
            if (this.connected) {
                return;
            }
            this.connect();
        }, RECONNECT_INTERVAL);
    },

    _send(event, message) {
        try {
            this.socket.emit(event, message);
            // If server is down, a non-writeable stream error is thrown.
        } catch (err) {
            this.log.error("ERROR: Unable to send message over socket.");
            this.connected = false;
            this.reconnect();
        }
    }
};

exports.Agent = Agent;
