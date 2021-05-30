/*globals $, app, utils, socket, config*/

$(window).on('action:topic.loaded', function()
{
	var benchpress = undefined;
	require(["benchpress"], function (Benchpress){
		benchpress = Benchpress;
	});

	// get a rating overview
	getOverviewElm = function(pid, rid)
	{
		return $('[component="rating/overview"][data-pid="'+pid+'"][data-rid="'+rid+'"]');
	}

	// Adjust a count of a rating overview.
	adjustCount = function(pid, rid, amount)
	{
		var el = getOverviewElm(pid, rid);
		var count_el = el.find('span').first();
		var count = parseInt(count_el.data('count')) + amount;

		// Remove it if there are no more ratings here.
		if( count == 0 )
		{
			el.remove();
			return;
		}

		count_el.attr('data-count', count)
		count_el.text('x' + count);
	}

	// Get or create a user element based on pid, rid and uid.
	getUserElement = function(pid, rid, user, callback)
	{
		var el = $('[component="rating/verbose/name"][data-pid="'+pid+'"][data-uid="'+user.uid+'"]');
		if ( el.length === 0 )
		{
			benchpress.parse( 'partials/ratings/user', {
				pid : pid,
				rid : rid,
				uid : user.uid,
				username : user.username,
				userslug : user.userslug
			}, function(html){
				return callback($($.parseHTML(html)), true);
			})
		}
		else
		{
			return callback(el, false);
		}
	}

	// Get or create a verbose element
	getVerboseElement = function( pid, rid, callback )
	{
		var el = $('[component="rating/verbose"][data-pid="'+pid+'"][data-rid="'+rid+'"]');
		if ( el.length === 0 )
		{
			benchpress.parse('partials/ratings/verbose', {
				pid : pid,
				rid : rid,
			}, function(html) {
				return callback( $($.parseHTML(html)), true );
			})
		}
		else
		{
			return callback(el);
		}
	}

	// Main update function
	updateRating = function(data)
	{
		// Create the preview for this rating.
		var overview = getOverviewElm( data.pid, data.rid );
		if( overview.length === 0 )
		{
			overview = benchpress.parse('partials/ratings/overview', {
				pid   : data.pid,
				rid   : data.rid,
				count : 1
			}, function(html){
				$('[component="ratings/overview"][data-pid="' + data.pid + '"]').append(html);
			})
		}
		else
		{
			adjustCount(data.pid, data.rid, 1);
		}

		// Get or create the rating user (the name shown when you open verbose mode)
		getUserElement(data.pid, data.rid, data.user, function(user_el, isnew){
			var oldrid = !isnew ? user_el.parent().parent().attr('data-rid') : null;

			// Dicrease count on prev rating if user has voted before.
			if(oldrid) adjustCount(data.pid, oldrid, -1);

			// If verbose section doesn't exist then create it.
			getVerboseElement(data.pid, data.rid, function(ver_el){
				ver_el.find('.rating-names').first().append(user_el);
				$('[component="ratings/verbose"][data-pid="'+data.pid+'"]').append(ver_el);

				cleanVerbose(data.pid, oldrid);
			});
		});
	}

	// Find empty sections and clean them out.
	cleanVerbose = function(pid, rid)
	{
		var section = $('[component="rating/verbose"][data-pid="'+ pid + '"][data-rid="' + rid + '"');
		if(!section) return;

		if(section.find('.rating-names').first().children().length == 0)
		{
			section.remove();
			$('[component="rating/overview"][data-pid="'+ pid + '"][data-rid="' + rid + '"').remove();
		}
	}

	// Show verbose ratings
	viewVerbose = function(e)
	{
		var el = $(this);
		var pid = el.data('pid');
		var verb_el = $('[component="ratings/verbose"][data-pid="'+ pid + '"]');

		verb_el.toggleClass('hidden');
	}

	// Submit a rating to the server.
	// This is also used for updating a rating to a new one.
	sendRating = function(e)
	{
		var rating_el = $(this);
		var tid = $('[component="topic"]').attr("data-tid");
		var pid = rating_el.parent().attr("data-pid");
		var rid = rating_el.attr("data-rid");

		if (!tid || !pid || !rid) return;

		socket.emit('plugins.ratings.ratePost', {
			tid : tid,
			pid : pid,
			rid : rid
		}, function(err){
			if (err) app.alertError(err.message);
			$('[component="ratings/rate"][data-pid="'+ pid + '"]').addClass("hidden");
		})
	}

	// When all data is loaded start listening on a socket and
	// hook up rating clicking.
	var loaded = false;
	$(window).on('action:ajaxify.end', function(ev,data)
	{
		// Only run in /topics/*
		if (!data.url || !data.url.match('^topic/'))
			return;

		$('[component="ratings/show"]').click(viewVerbose);
		$('[component="ratings/add"]').click(sendRating);
		
		if(!loaded)
		{
			socket.on('event:ratings.rated', updateRating);
			loaded = true;
		}
	});
});