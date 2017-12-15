const _ = require('underscore');

// NodeClient is a server/machine/instance running a agent socket 
const NodeClient = function (nodeId, socket, server) {
    this.nodeId = nodeId;
    this.socket = socket;
    this.iport = socket.handshake.headers.host;
    this.id = socket.id;
    this.log_server = server;

    // Join 'nodes' room
    socket.join('nodes');

    socket.on('disconnect', () => {
        // Notify all WebClients upon disconnect
        socket.leave('nodes');
    });
}

module.exports = {
    NodeClient: NodeClient
}
