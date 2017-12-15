const io = require('socket.io');
const _ = require('underscore');
const nodeClient = require('./nodeclient.js');
const webClient = require('./webclient.js');
const logging = require('../common/logging').Logger;
const stat = require('../monitor/stat');
const starter = require('./starter');

const STATUS_INTERVAL = 60 * 1000; // 60 seconds
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const STATUS_IDLE = 0;
const STATUS_READY = 1;
const STATUS_RUNNING = 2;
const STATUS_DISCONN = 3;
/**
 *
 * robot master instance
 *
 * @param {Object} conf
 *
 * conf.main client run file
 */
const Server = function (conf) {
    this.log = logging;
    this.nodes = {};
    this.web_clients = {};
    this.conf = conf || {};
    this.runconfig = null;
    this.status = STATUS_IDLE;
};

Server.prototype = {

    listen(port) {
        this.io = io.listen(port);
        this.register();
    },

    logCount() {
        this.log.info("Nodes: " + _(this.nodes).size() + ", " + "WebClients: " + _(this.web_clients).size());
    },

    // Registers new Node with Server, announces to WebClients
    announce_node(socket, message) {
        let nodeId = message.nodeId;
        if (!!this.nodes[nodeId]) {
            this.log.warn("Warning: Node '" + nodeId + "' already exists, delete old items ");
            socket.emit('node_already_exists');
            delete this.nodes[nodeId];
        }

        let node = new nodeClient.NodeClient(nodeId, socket, this);
        this.nodes[nodeId] = node;

        _(this.web_clients).each(web_client => web_client.add_node(node));

        socket.on('disconnect', () => {
            delete this.nodes[nodeId];
            _(this.web_clients).each(web_client => web_client.remove_node(node));
            if (_.size(this.nodes) <= 0) {
                this.status = STATUS_IDLE;
            }
            stat.clear(nodeId);
            this.logCount();
        });

        socket.on('report', (message) => stat.merge(nodeId, message));

        /* temporary code */
        socket.on('error', (message) => {
            _(this.web_clients).each((web_client) => web_client.error_node(node, message));
        });
        socket.on('crash', (message) => {
            _(this.web_clients).each((web_client) => web_client.error_node(node, message));
            this.status = STATUS_READY;
            this.sendStatus();
        });
        /* temporary code */
    },

    // Registers new WebClient with Server
    announce_web_client(socket) {
        let web_client = new webClient.WebClient(socket, this);
        this.web_clients[web_client.id] = web_client;
        _(this.nodes).each((node, nlabel) => web_client.add_node(node));

        socket.on('webreport', (message) => {
            if (this.status == STATUS_RUNNING) {
                socket.emit('webreport', this.runconfig.agent, this.runconfig.maxuser, stat.getTimeData(this), stat.getCountData());
            }
        });

        socket.on('detailreport', (message) => {
            if (this.status == STATUS_RUNNING) {
                socket.emit('detailreport', stat.getDetails());
            }
        });

        socket.on('disconnect', () => {
            delete this.web_clients[web_client.id];
            this.logCount();
        });
    },

    // Register announcement, disconnect callbacks
    register() {
        this.io.sockets.on('connection', (socket) => {
            socket.on('announce_node', (message) => {
                this.log.info("Registering new node " + JSON.stringify(message));
                this.announce_node(socket, message);
                this.logCount();
            });

            socket.on('announce_web_client', (message) => {
                this.log.info("Registering new web_client");
                this.announce_web_client(socket);

                this.logCount();

                socket.emit('statusreport', {status: this.status});

                socket.on('run', (msg) => {
                    stat.clear();
                    msg.agent = _.size(this.nodes);
                    console.log('server begin notify client to run machine...');
                    this.runconfig = msg;
                    let i = 0;
                    _.each(this.nodes, function (ele) {
                        //web.log(i++);
                        msg.index = i++;
                        ele.socket.emit('run', msg);
                    });
                    //this.io.sockets.in('nodes').emit('run',msg);
                    this.status = STATUS_RUNNING;
                    this.sendStatus();
                });

                socket.on('ready', (msg) => {
                    console.log('server begin ready client ...');
                    this.io.sockets.in('nodes').emit('disconnect', {});
                    stat.clear();
                    this.status = STATUS_READY;
                    this.sendStatus();
                    this.runconfig = msg;
                    starter.run(this.conf.mainFile, msg, this.conf.clients);
                });

                socket.on('exit4reready', () => {
                    _.each(this.nodes, (obj) => obj.socket.emit('exit4reready'));
                    this.nodes = {};
                });
            });
        });

        // Broadcast heartbeat to all clients
        setInterval(() => this.io.sockets.emit('heartbeat'), HEARTBEAT_INTERVAL);
    },

    sendStatus(){
        this.io.sockets.in('web_clients').emit('statusreport', {status: this.status});
    }
};

exports.Server = Server;
