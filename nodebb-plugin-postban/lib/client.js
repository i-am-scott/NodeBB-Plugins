 /*globals $, app, utils, socket, templates, config*/

$(document).ready(function()
{
    var showBanModal = function( self )
    {
        var tid = $('[component="topic"]').attr('data-tid');
        var uid = $(this).attr('data-uid');
        var pid = $(this).attr('data-pid');

        if(!uid || !pid) return;

        templates.parse('admin/partials/temporary-ban', {}, function (html) {
            bootbox.dialog({
                className: 'ban-modal',
                title: '[[user:ban_account]]',
                message: html,
                show: true,
                buttons: {
                    close: {
                        label: '[[global:close]]',
                        className: 'btn-link',
                    },
                    submit: {
                        label: '[[admin/manage/users:alerts.button-ban-x, 1]]',
                        callback: function () {
                            var formData = $('.ban-modal form').serializeArray().reduce(function (data, cur) {
                                data[cur.name] = cur.value;
                                return data;
                            }, {});
                            var until = formData.length ? (Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))) : 0;
                            var data  = { uid: uid, pid: pid, tid: tid, until: until, reason: formData.reason };
                            socket.emit('plugins.postban.banPost', data, done('[[admin/manage/users:alerts.ban-success]]', data));
                        },
                    },
                },
            });
        });
    }

    var done = function(successMessage, data) {
        return function (err) {
            if (err)
                return app.alertError(err.message);

            app.alertSuccess(successMessage);
        };
    }

    var running = {};
    var updatePost = function(data)
    {
        // Bad
        if(running[data.pid]) return;
        running[data.pid] = true;

        var reason = '<div class="postbit-banned"><i class="fa fa-error"></i> (User was banned for this post ("'+ data.reason + '" - <a href="/user/'+data.admin.userslug+'">'+data.admin.username+'</a>))</div>';
        var postcontainer = $('[component="post"][data-pid="' + data.pid + '"]');
        var contents = postcontainer.find( '[component="post/content"]' ).first();

        var edited = contents.children('.postbit-edited')
        if(edited.length > 0){
            edited.first().before(reason);
        }else{
            contents.append(reason);
        }

        require(['sounds'], function(s) {
            s.playSound('Postban | Gottem');
        });

        // Replace all users avatars with banned image
        postcontainer.find('[component="user/picture"]').attr('src', '/plugins/nodebb-theme-sup/images/avatar_banned_user.png');

        // Colour their name red
        postcontainer.find('[itemprop="author"]').css("cssText", "color: #f40000 !important;");

        delete running[data.pid];
    }

    $(window).on('action:ajaxify.end', function(ev,data)
    {
        if (!data.url || !data.url.match('^topic/'))
            return;

        $('[component="post/ban"]').click(showBanModal);
        socket.on('event:postban.banned', updatePost);
    });

});