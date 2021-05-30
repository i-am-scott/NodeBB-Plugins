let
rate          = require( './lib/data.js' ),
nodebb        = require( './lib/nodebb.js' ),
websockets    = module.parent.require('../src/socket.io/index'),
SocketPlugins = module.parent.require('../src/socket.io/plugins'),
SpamCheck     = {};

ratecore           = {};
module.exports = ratecore;

ratecore.init = (params, callback) =>
{
	SocketPlugins.ratings = {
		ratePost: ratecore.ratePost
	};

	callback();
}

ratecore.getTopicRatings = ( data, next ) =>
{
	if (!data || !data.topic)
		return next(null, data);

	rate.getAllowedRatings(data.uid, function (err, ratings) {
		if (err) return next(err);

		data.topic.rate = {
			can_rate   : rate.canRateInTopic( data.topic.cid, data.topic.tid, data.uid ),
			image_path : rate.img_base,
			ratings: ratings || {}
		}

		next(null, data);
	});
}

ratecore.getPostRatings = ( data, callback ) => {
	rate.getPostsRatings( data, callback );
}

ratecore.ratePost = ( socket, data, callback ) =>
{
	let uid = socket.uid;
	if (!uid)
		return callback(new Error('[[error:not-logged-in]]'));

	let now = Date.now() / 1000;
	if( SpamCheck[uid] && SpamCheck[uid] > now )
	{
		return callback();
	}

	SpamCheck[uid] = now + 2;

	rate.rate( uid, data.tid, data.pid, data.rid, ( err, status, rate_data ) => {
		rate.removeInMotion( uid, data.pid );

		if(err)
			return callback(err);

		nodebb.User.getUserFields( uid, [ "username", "userslug" ], ( err, user ) => {
			if ( err )
				return callback(err);

			websockets.in('topic_' + data.tid ).emit( 'event:ratings.rated', {
				uid      : uid,
				tid      : data.tid,
				pid      : data.pid,
				rid      : data.rid,
				status   : status,
				user     : {
					uid : uid,
					username : user.username,
					userslug : user.userslug
				}
			});

			callback();
		});
	});
}