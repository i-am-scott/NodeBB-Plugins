let nodebb = require('./nodebb.js'),
	_ = require('underscore'),
	async = require('async'),
	groups = require.main.require('./src/groups');

rate = { ratingInProgress : {} };
module.exports  = rate;

rate.img_base = "plugins/nodebb-plugin-ratings/images/";
rate.ratings = {
	administrators: {
		thinking : "Thinking",
		angry : "Angry",
	},
	default: {
		agree : "Agree",
		disagree : "Disagree",
		funny : "Funny",
		winner : "Winner",
		zing : "Zing",
		informative : "Informative",
		friendly : "Friendly",
		useful : "Useful",
		optimistic : "Optimistic",
		artistic : "Artistic",
		late : "Late",
		badspelling : "Bad Spelling",
		dumb : "Dumb",
	},
};

rate.perms = {
	administrators: {
		rateSelf	: true
	},
	default: {
		rateSelf	: false
	}
}

rate.NO_EXIST       = 1;
rate.RATED          = 2;
rate.UPDATED        = 3;
rate.REMOVED        = 4;
rate.ALREADY_RATING = 5;

rate.getAllowedRatings = function(uid, callback)
{
	groups.getUserGroups([uid], function (err, users) {
		if (err) return callback(err);

		var perms = rate.perms.default;
		var allowed = Object.assign({}, rate.ratings.default);

		users.forEach(user => {
			user.forEach(group => {
				if (rate.ratings[group.name]) {
					Object.assign(allowed, rate.ratings[group.name]);
				}
				if (rate.perms[group.name]) {
					perms = rate.perms[group.name];
				}
			})
		});

		callback(null, allowed, perms);
	});
}

rate.getPostRatings = ( post, callback ) =>
{
	callback     = callback || function(){};

	nodebb.db.getSortedSetRange('ratings:' + post.pid + ':types', 0, -1, ( err, rating_ids ) => {
		if( err ) return callback(err);
		if(!rating_ids || !rating_ids.length) return callback( new Error( "No ratings were found." ) );

		post.ratings     = {};
		post.has_ratings = true;

		_.each( rating_ids, rid => {
			nodebb.db.getSetMembers('ratings:' + post.pid + ':' + rid, ( err, uids ) => {
				if(!uids || !uids.length) return;

				nodebb.User.getUsersFields ( uids, [ 'uid', 'username', 'userslug', 'banned' ], ( err, data ) => {
					post.ratings[rid] = {
						count : data.length,
						users : data ,
						extra : rid
					};
				});
			});
		});

		callback( null, post );
	});
}

rate.getPostsRatings = ( data, callback ) =>
{
	async.eachSeries(data.posts, function (post, next) {
		rate.getPostRatings( post, () => {
			next();
		});
	},
	err => {
		if( err ) return callback(err);
		callback(null,data);
	});
}

rate.rate = ( uid, tid, pid, rid, callback ) =>
{
	rate.getAllowedRatings(uid, function (err, ratings, perms) {
		if (err) return callback(err);

		if( !ratings || !ratings[rid] )
			return callback(null, rate.NO_EXIST);

		if(rate.isInMotion(uid,pid))
			return callback(null, rate.ALREADY_RATING );

		nodebb.Posts.isOwner( pid, uid, ( err, is_owner ) => {
			if ( is_owner && !perms.rateSelf) return callback(new Error( "You cannot rate your own posts." ));

			rate.setInMotion( uid, pid );

			nodebb.db.getSortedSetRange( 'ratings:' + pid + ':types', 0, -1, (err, rids) => {
				if ( err ) return callback(err);

				if(!rids || rids.length === 0)
				{
					rate.addRatingFinalized( uid, tid, pid, rid, ratings, callback )
					return;
				}

				let type_sets = ('ratings:' + pid + ':' + rids.join( ',ratings:' + pid + ':' )).split(',');

				nodebb.db.setsRemove( type_sets, uid, ( err ) => {
					if (err) return callback(err);
					rate.addRatingFinalized( uid, tid, pid, rid, ratings, callback );
				});
			});
		});
	});
}

rate.addRatingFinalized = ( uid, tid, pid, rid, ratings, callback ) =>
{
	let pos = _.findIndex( ratings, ( rating, i ) => i == rid ) || 0;
	nodebb.db.sortedSetAdd( 'ratings:' + pid + ':types', pos, rid );

	nodebb.db.setAdd( 'ratings:' + pid + ':' + rid, uid, err => {
		callback( err, rate.RATED );
	});
}

rate.setInMotion = ( uid, pid ) =>
{
		rate.ratingInProgress[uid] = rate.ratingInProgress[uid] || [];
		rate.ratingInProgress[uid].push(pid);
}

rate.isInMotion = ( uid, pid ) =>
{
	return Array.isArray(rate.ratingInProgress[uid]) && rate.ratingInProgress[uid].indexOf(pid) !== -1;
}

rate.removeInMotion = ( uid, pid ) =>
{
	let queue = rate.ratingInProgress[uid];
	if ( queue )
	{
		var index = queue.indexOf( pid );
		if( index !== -1 )
			queue = queue.splice( index, 1 );
	}
}

rate.hasRatedPost = ( uid, ratings ) =>
{
	if(!ratings) return false;
	_.each( ratings, ( val ) => {
		if( _.contains( val, uid ) ){
			return true;
		}
	});
}

rate.canRateInTopic = ( cid, tid, uid ) =>
{
	return true;
}

rate.canRatePost = ( tid, uid ) =>
{
	if(!rate.canRateInTopic(tid, uid)) return false;
	return true;
}
