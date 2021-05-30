let nodebb = require('./nodebb.js'),
async      = require('async'),
winston    = nodebb.winston,
user       = nodebb.User,
db         = nodebb.db,
privileges = nodebb.privileges;

bans = {};
module.exports = bans;

bans.Ban = (auid, uid, pid, until, reason, callback) =>
{
        auid  = parseInt(auid);
        uid   = parseInt(uid);
        pid   = parseInt(pid);
        until = parseInt(until, 10);

		async.waterfall([
            function(next){
                privileges.users.canBanUser(auid, uid, next);
            },
            function(canBanUser, next){
                if(!canBanUser)
                    return next(new Error('[[error:no-privileges]]'));

                user.isBanned(uid, next);
            },
			function (isBanned, next)
            {
                if(isBanned)
                    return next(new Error('User is already banned!'));

				user.isAdministrator(uid, next);
			},
            function (isAdmin, next)
            {
				if (isAdmin)
					return next(new Error('[[error:cant-ban-other-admins]]'));

                user.ban(uid, until, reason, function(err){
                    let postban_data = {
                        aid: auid,
                        pid: pid,
                        reason: reason,
                        until: until,
                        perma: until == 0
                    };
                    db.setObject('postbans:' + pid, postban_data, next);
                });
			}
        ], callback);
}

bans.GetPostBan = (post, callback) =>
{
    callback     = callback || function(){};

    db.getObject('postbans:' + post.pid, (err, bandata) => {
        if(err) return callback(err);

        if(!bandata)
            return callback('Ban data not found');

        user.getUserFields(bandata.aid, ['uid', 'username', 'userslug'], (err, data) => {
            if(err) return callback(err);

            bandata.admin = data;

            post.banned = true;
            post.banned_data = bandata;

            callback(true, post);
        });
    });
}

/*
setTimeout(function() {
    bans.Ban(1, 4, 64, 243324, 'Shit posting shitter', function(err){
        winston.info(err);
    })
}, 8888);
*/