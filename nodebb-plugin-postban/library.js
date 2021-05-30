let
bans          = require( './lib/data.js' ),
nodebb        = require( './lib/nodebb.js' ),
websockets    = module.parent.require('../src/socket.io/index'),
SocketPlugins = module.parent.require('../src/socket.io/plugins'),
winston       = nodebb.winston,
plugins       = nodebb.plugins,
async		  = nodebb.async,
user		  = nodebb.User

postban        = {};
module.exports = postban;

postban.init = (params, callback) =>
{
	SocketPlugins.postban = {
		banPost: postban.requestBan
	};

	callback();
}

postban.requestBan = ( socket, data, callback )  =>
{
	let uid = socket.uid;
	if (!uid) return callback(new Error('[[error:not-logged-in]]'));
	data.reason = !data.reason || data.length == 0 ? 'No reason specified' : data.reason;

	bans.Ban( uid, data.uid, data.pid, data.until, data.reason, ( err ) => {
		if(err) return callback(err);

		plugins.fireHook('action:user.banned', {
			callerUid: uid,
			ip: socket.ip,
			uid: data.uid,
			until: data.until > 0 ? data.until : undefined,
		});

		user.getUserFields(uid, ['uid', 'username', 'userslug'], (err, admin) => {
			websockets.in('topic_' + data.tid ).emit( 'event:postban.banned', {
				pid: data.pid,
				admin: admin,
				reason: data.reason,
			});
		});

		callback();
	});
}

postban.getPostBanInfo = ( data, callback ) =>
{
	async.eachSeries(data.posts, function (post, next) {
		bans.GetPostBan( post, function(success, post)
		{
			next();
		});
	},
	err => {
		callback(err ? err : null,data);
	});
}