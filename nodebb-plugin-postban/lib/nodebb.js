"use strict";

(function(NodeBB) {
	module.exports = {
		User: NodeBB.require('./src/user'),
		SocketIndex: NodeBB.require('./src/socket.io/index'),
		SocketPlugins: NodeBB.require('./src/socket.io/plugins'),
		db: NodeBB.require('./src/database'),
		winston: NodeBB.require('winston'),
		plugins: NodeBB.require('./src/plugins'),
		async: NodeBB.require('async'),
		privileges: NodeBB.require('./src/privileges')
	}
})(require.main);