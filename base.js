define(['module', 'safe', 'lodash', 'dust', 'md5', 'jquery', 'jquery-cookie'], function(module, safe, _, dust, md5) {
    var array = [];
    var push = array.push;
    var slice = array.slice;
    var splice = array.splice;
    var config = (module.config && module.config()) || {};
    var debug = config.debug || false;

    // Make sure dust.helpers is an object before adding a new helper.
    if (!dust.helpers)
        dust.helpers = {};

    dust.helpers.view = function(chunk, context, bodies, params) {
        return chunk.map(function(chunk) {
            requirejs([params.name], function(View) {
                var view = new View({
                    app: context.get('_t_app')
                });
                var parent = context.get('_t_view');
                view.data = params.data ? context.get(params.data) : context.get([], true);
                view.dataPath = params.data ? params.data : ".";
                parent.attachSubView(view)
                    // need to overwrite getting base context
                    // to current one, because it is subview
                view.getBaseTplCtx = function(cb) {
                    safe.back(cb, null, context);
                }
                view.render(function(err, text) {
                    if (err) console.log(err.stack)
                    chunk.end(text);
                })
            })
        });
    };

    debug && dust.config && (dust.config.whitespace = true);

    // A module that can be mixed in to *any object* in order to provide it with
    // custom events. You may bind with `on` or remove with `off` callback
    // functions to an event; `trigger`-ing an event fires all callbacks in
    // succession.
    //
    //     var object = {};
    //     _.extend(object, Backbone.Events);
    //     object.on('expand', function(){ alert('expanded'); });
    //     object.trigger('expand');
    //
    var Events = {

        // Bind an event to a `callback` function. Passing `"all"` will bind
        // the callback to all events fired.
        on: function(name, callback, context) {
            if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({
                callback: callback,
                context: context,
                ctx: context || this
            });
            return this;
        },

        // Bind an event to only be triggered a single time. After the first time
        // the callback is invoked, it will be removed.
        once: function(name, callback, context) {
            if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
            var self = this;
            var once = _.once(function() {
                self.off(name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.on(name, once, context);
        },

        // Remove one or many callbacks. If `context` is null, removes all
        // callbacks with that function. If `callback` is null, removes all
        // callbacks for the event. If `name` is null, removes all bound
        // callbacks for all events.
        off: function(name, callback, context) {
            var retain, ev, events, names, i, l, j, k;
            if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
            if (!name && !callback && !context) {
                this._events = void 0;
                return this;
            }
            names = name ? [name] : _.keys(this._events);
            for (i = 0, l = names.length; i < l; i++) {
                name = names[i];
                if (events = this._events[name]) {
                    this._events[name] = retain = [];
                    if (callback || context) {
                        for (j = 0, k = events.length; j < k; j++) {
                            ev = events[j];
                            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                                (context && context !== ev.context)) {
                                retain.push(ev);
                            }
                        }
                    }
                    if (!retain.length) delete this._events[name];
                }
            }

            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function(name) {
            if (!this._events) return this;
            var args = slice.call(arguments, 1);
            if (!eventsApi(this, 'trigger', name, args)) return this;
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },

        // Tell this object to stop listening to either specific events ... or
        // to every object it's currently listening to.
        stopListening: function(obj, name, callback) {
            var listeningTo = this._listeningTo;
            if (!listeningTo) return this;
            var remove = !name && !callback;
            if (!callback && typeof name === 'object') callback = this;
            if (obj)(listeningTo = {})[obj._listenId] = obj;
            for (var id in listeningTo) {
                obj = listeningTo[id];
                obj.off(name, callback, this);
                if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
            }
            return this;
        }

    };

    // Regular expression used to split event strings.
    var eventSplitter = /\s+/;

    // Implement fancy features of the Events API such as multiple event
    // names `"change blur"` and jQuery-style event maps `{change: action}`
    // in terms of the existing API.
    var eventsApi = function(obj, action, name, rest) {
        if (!name) return true;

        // Handle event maps.
        if (typeof name === 'object') {
            for (var key in name) {
                obj[action].apply(obj, [key, name[key]].concat(rest));
            }
            return false;
        }

        // Handle space separated event names.
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, l = names.length; i < l; i++) {
                obj[action].apply(obj, [names[i]].concat(rest));
            }
            return false;
        }

        return true;
    };

    // A difficult-to-believe, but optimized internal dispatch function for
    // triggering events. Tries to keep the usual cases speedy (most internal
    // Backbone events have 3 arguments).
    var triggerEvents = function(events, args) {
        var ev, i = -1,
            l = events.length,
            a1 = args[0],
            a2 = args[1],
            a3 = args[2];
        switch (args.length) {
            case 0:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx);
                return;
            case 1:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1);
                return;
            case 2:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1, a2);
                return;
            case 3:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
                return;
            default:
                while (++i < l)(ev = events[i]).callback.apply(ev.ctx, args);
                return;
        }
    };

    var listenMethods = {
        listenTo: 'on',
        listenToOnce: 'once'
    };

    // Inversion-of-control versions of `on` and `once`. Tell *this* object to
    // listen to an event in another object ... keeping track of what it's
    // listening to.
    _.each(listenMethods, function(implementation, method) {
        Events[method] = function(obj, name, callback) {
            var listeningTo = this._listeningTo || (this._listeningTo = {});
            var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
            listeningTo[id] = obj;
            if (!callback && typeof name === 'object') callback = this;
            obj[implementation](name, callback, this);
            return this;
        };
    });

    // Aliases for backwards compatibility.
    Events.bind = Events.on;
    Events.unbind = Events.off;

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    var extend = function(protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function() {
                return parent.apply(this, arguments);
            };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function() {
            this.constructor = child;
        };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };


    var View = function(options) {
        this.app = options.app;
        this.parent = null;
        this.views = [];
        this.cid = _.uniqueId('v');
        this.name = this.constructor.id;
        options || (options = {});
        _.extend(this, _.pick(options, viewOptions));
    }

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be merged as properties.
    var viewOptions = ['data', 'el', 'id', 'className', 'tagName', 'events', 'app'];

    _.extend(View.prototype, Events, {
        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',

        // jQuery delegate for element lookup, scoped to DOM elements within the
        // current view. This should be preferred to global lookups where possible.
        $: function(selector) {
            return this.$el.find(selector);
        },

        // postRender is function called in browser when DOM rendered and
        // views are bound. Redefine in your own views, but don't forget to
        // call base
        postRender: function() {
            // this.$el.prepend("<font style='position:absolute;left:"+this.$el.offset().left+";top:"+this.$el.offset().top+";' color='red'>"+this.name+" "+this.cid+"</font>");
        },

        // used internally to bind view to already available DOM model
        // based on wire data provided by server
        bindWire: function(wire, parent, ctx, cb) {
            var self = this;
            if (!parent) {
                // root view :)
                parent = this;
                this.parent = null;
                this.data = wire.data;
                this.locals = wire.locals;
                this.setElement($(document.body))
            } else {
                // any other
                parent.attachSubView(self);
                var $el = parent.$el.find("#" + wire.cid);
                if ($el.length != 1)
                    return safe.back(cb, new Error("View '" + wire.name + "' can't find its unique element"))
                $el.attr('id', this.cid);
                this.data = _.isString(wire.data) ? (wire.data == "." ? ctx.get([], true) : ctx.get(wire.data)) : wire.data;
                this.setElement($el)
            }

            safe.run(function(cb) {
                if (!ctx)
                    self.getBaseTplCtx(cb);
                else
                    cb(null, ctx)
            }, safe.sure(cb, function(ctx) {
                self.populateTplCtx(ctx, safe.sure(cb, function(ctx) {
                    safe.each(wire.views, function(wireView, cb) {
                        requirejs([wireView.name], function(View) {
                            var view = new View({
                                app: self.app
                            });
                            view.bindWire(wireView, self, ctx, cb);
                        }, cb)
                    }, cb)
                }))
            }))
        },

        // This is magic function that links just rendered dom model
        // with view hierarchy. Magic happens when previous (donor)
        // view is available. While binding we can take some parts
        // of donor view as is (avoid redraw or state change)
        bindDom: function($dom, donor) {
            var self = this;
            var mutable = !!donor;
            if (mutable) {
                // views should have same class
                if (donor.name != this.name)
                    mutable = false;
                // view should have same ammount of subviews
                if (donor.views.length != this.views.length)
                    mutable = false;
                else {
                    // subview order and types should match
                    _.each(this.views, function(lview, i) {
                        var rview = donor.views[i];
                        if (lview.name != rview.name)
                            mutable = false;
                    })
                }
            }

            if (!mutable) {
                // just recursively bound elements
                this.setElement($dom, {
                    delegate: true,
                    render: true,
                    recursive: true
                });
            } else {
                // lets try to mutate childs
                var movedViews = [];
                _.each(donor.views, function(lview, i) {
                        var rview = self.views[i];
                        var $rdom = $dom.find("#" + rview.cid);
                        // equaity of data that views are build upon ies a sign
                        // that view is not need to be recreated
                        if (lview.md5 == rview.md5 && _.isEqual(lview.data, rview.data)) {
                            // move dom subnodes
                            $rdom.replaceWith(lview.$el)
                                // detach lview
                            movedViews.push({
                                view: lview,
                                parent: rview.parent
                            });
                            // implant into right
                            lview.data = rview.data;
                            self.views[i] = lview;
                        } else {
                            rview.bindDom($rdom, lview)
                        }
                    })
                    // remove transplanted views from tree
                _.each(movedViews, function(mv) {
                    donor.detachSubView(mv.view);
                    mv.view.parent = mv.parent;
                })
                self.setElement($dom, {
                    delegate: true,
                    render: true,
                    recursive: false
                });
            }
        },

        attachSubView: function(view) {
            if (view.parent)
                throw new Error("View already has parent")
            view.parent = this;
            this.views.push(view);
        },

        detachSubView: function(view) {
            if (view.parent != this)
                throw new Errror("View is attached to another parent")
            view.parent = null;
            this.views = _.reject(this.views, function(v) {
                return v.cid == view.cid;
            })
        },

        // by convension this should return initial (root) dust content
        // which will be the base for actual rendeting
        getBaseTplCtx: function(cb) {
            // by default lets delegate this to app
            this.app.getBaseTplCtx(cb);
        },

        // used to populate base content by data that are specific for this this
        populateTplCtx: function(ctx, cb) {
            ctx = ctx.push(_.extend(this.locals || {}, {
                _t_view: this
            }));
            if (this.data)
                ctx = ctx.push(this.data);
            safe.back(cb, null, ctx);
        },

        // renders inner view content (free form), unlikely need to be
        // redefined
        renderHtml: function(cb) {
            var self = this;
            var tplName = "dustc!"+self.id+".dust";
            safe.parallel({
				template: function (cb) {
					// check for proper use
					if (!self._rendered) {
						if (!require.defined(tplName))
							return cb(new Error("Primary view template should be load prior to view render"))
						self._rendered = true;
					}

					require([tplName], function () {
						cb(null);
					},cb)
				},
                context: function(cb) {
                    self.getBaseTplCtx(safe.sure(cb, function(ctx) {
                        self.populateTplCtx(ctx, cb)
                    }))
                }
            }, safe.sure(cb, function(res) {
                dust.render(self.id, res.context, safe.sure(cb, function (text) {
					// in debug mode undefine templat so it will be reloaded each time
					if (debug)
						require.undef(tplName);
					this.md5 = md5(text);
					cb(null, text);
				}))
            }))
        },

        // renders final view content including wrapper element (!!!)
        render: function(cb) {
            var self = this;
            this.renderHtml(safe.sure(cb, function(text) {
                cb(null, "<div id='" + self.cid + "'>" + text + "</div>");
            }))
        },

        // completely refresh current view
        refresh: function(cb) {
            var self = this;
            this.renderHtml(safe.sure(cb, function(text) {
                self.removeChild;
                self.$el.html(text);
                cb();
            }))
        },

        // Remove this view by taking the element out of the DOM, and removing any
        // applicable Backbone.Events listeners.
        remove: function() {
            if (this.$el) {
                this.undelegateEvents();
                this.$el.remove();
            }
            this.removeChilds();
            this.stopListening();
            if (this.parent) {
                this.parent.detachSubView(this)
            }
            return this;
        },

        removeChilds: function() {
            _.each(this.views, function(child) {
                child.remove();
            })
            if (this.views.length)
                throw new Error("Invalid subview links?")
            return this;
        },

        // Change the view's element (`this.el` property), including event
        // re-delegation.
        setElement: function(element, options) {
            var self = this;
            options = options || {
                delegate: true,
                render: true,
                recursive: false
            };
            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof $ ? element : $(element);
            this.el = this.$el[0];
            if (options.delegate)
                this.delegateEvents();
            if (options.render)
                this.postRender();
            if (options.recursive) {
                _.each(this.views, function(child) {
                    var $el = self.$el.find("#" + child.cid);
                    if ($el.length != 1)
                        throw new Error("Child view '" + child.name + "' can't find its root element");
                    child.setElement($el, options);
                })
            }
            return this;
        },

        // Set callbacks, where `this.events` is a hash of
        //
        // *{"event selector": "callback"}*
        //
        //     {
        //       'mousedown .title':  'edit',
        //       'click .button':     'save',
        //       'click .open':       function(e) { ... }
        //     }
        //
        // pairs. Callbacks will be bound to the view, with `this` set properly.
        // Uses event delegation for efficiency.
        // Omitting the selector binds the event to `this.el`.
        // This only works for delegate-able events: not `focus`, `blur`, and
        // not `change`, `submit`, and `reset` in Internet Explorer.
        delegateEvents: function(events) {
            if (!(events || (events = _.result(this, 'events')))) return this;
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) method = this[events[key]];
                if (!method) continue;

                var match = key.match(delegateEventSplitter);
                var eventName = match[1],
                    selector = match[2];
                method = _.bind(method, this);
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.on(eventName, method);
                } else {
                    this.$el.on(eventName, selector, method);
                }
            }
            return this;
        },

        // Clears all callbacks previously bound to the view with `delegateEvents`.
        // You usually don't need to use this, but may wish to if you have multiple
        // Backbone views attached to the same DOM element.
        undelegateEvents: function() {
            this.$el.off('.delegateEvents' + this.cid);
            return this;
        }

    })

    View.extend = extend;

    var Application = function(options) {
        options || (options = {});
        _.extend(this, _.pick(options, ["prefix"]));
    }

    _.extend(Application.prototype, Events, {
        getBaseTplCtx: function(cb) {
            var base = dust.makeBase({
                _t_app: this,
                _t_prefix: this.prefix
            })
            safe.back(cb, null, base);
        }
    })

    Application.extend = extend;

    getQueryStringKey = function(key) {
        return getQueryStringAsObject()[key];
    };


    getQueryStringAsObject = function() {
        var b, cv, e, k, ma, sk, v, r = {},
            d = function(v) {
                return decodeURIComponent(v).replace(/\+/g, " ");
            }, //# d(ecode) the v(alue)
            q = window.location.search.substring(1),
            s = /([^&;=]+)=?([^&;]*)/g //# original regex that does not allow for ; as a delimiter:   /([^&=]+)=?([^&]*)/g
        ;

        //# ma(make array) out of the v(alue)
        ma = function(v) {
            //# If the passed v(alue) hasn't been setup as an object
            if (typeof v != "object") {
                //# Grab the cv(current value) then setup the v(alue) as an object
                cv = v;
                v = {};
                v.length = 0;

                //# If there was a cv(current value), .push it into the new v(alue)'s array
                //#     NOTE: This may or may not be 100% logical to do... but it's better than loosing the original value
                if (cv) {
                    Array.prototype.push.call(v, cv);
                }
            }
            return v;
        };

        //# While we still have key-value e(ntries) from the q(uerystring) via the s(earch regex)...
        while (e = s.exec(q)) { //# while((e = s.exec(q)) !== null) {
            //# Collect the open b(racket) location (if any) then set the d(ecoded) v(alue) from the above split key-value e(ntry)
            b = e[1].indexOf("[");
            v = d(e[2]);

            //# As long as this is NOT a hash[]-style key-value e(ntry)
            if (b < 0) { //# b == "-1"
                //# d(ecode) the simple k(ey)
                k = d(e[1]);

                //# If the k(ey) already exists
                if (r[k]) {
                    //# ma(make array) out of the k(ey) then .push the v(alue) into the k(ey)'s array in the r(eturn value)
                    r[k] = ma(r[k]);
                    Array.prototype.push.call(r[k], v);
                }
                //# Else this is a new k(ey), so just add the k(ey)/v(alue) into the r(eturn value)
                else {
                    r[k] = v;
                }
            }
            //# Else we've got ourselves a hash[]-style key-value e(ntry)
            else {
                //# Collect the d(ecoded) k(ey) and the d(ecoded) sk(sub-key) based on the b(racket) locations
                k = d(e[1].slice(0, b));
                sk = d(e[1].slice(b + 1, e[1].indexOf("]", b)));

                //# ma(make array) out of the k(ey)
                r[k] = ma(r[k]);

                //# If we have a sk(sub-key), plug the v(alue) into it
                if (sk) {
                    r[k][sk] = v;
                }
                //# Else .push the v(alue) into the k(ey)'s array
                else {
                    Array.prototype.push.call(r[k], v);
                }
            }
        }

        //# Return the r(eturn value)
        return r;
    };

    /**
     * URL Router
     * @param {String} url, routing url.
     *  e.g.: /user/:id, /user/:id([0-9]+), /user/:id.:format?
     * @param {Boolean} [strict] strict mode, default is false.
     *  if use strict mode, '/admin' will not match '/admin/'.
     */
    function Router(url, strict) {
        this.keys = null;
        if (url instanceof RegExp) {
            this.rex = url;
            this.source = this.rex.source;
            return;
        }

        var keys = [];
        this.source = url;
        url = url.replace(/\//g, '\\/') // '/' => '\/'
            .replace(/\./g, '\\.?') // '.' => '\.?'
            .replace(/\*/g, '.+'); // '*' => '.+'

        // ':id' => ([^\/]+),
        // ':id?' => ([^\/]*),
        // ':id([0-9]+)' => ([0-9]+)+,
        // ':id([0-9]+)?' => ([0-9]+)*
        url = url.replace(/:(\w+)(?:\(([^\)]+)\))?(\?)?/g, function(all, name, rex, atLeastOne) {
            keys.push(name);
            if (!rex) {
                rex = '[^\\/]' + (atLeastOne === '?' ? '*' : '+');
            }
            return '(' + rex + ')';
        });
        // /user/:id => /user, /user/123
        url = url.replace(/\\\/\(\[\^\\\/\]\*\)/g, '(?:\\/(\\w*))?');
        this.keys = keys;
        var re = '^' + url;
        if (!strict) {
            re += '\\/?';
        }
        re += '$';
        this.rex = new RegExp(re);
    }

    /**
     * Try to match given pathname, if match, return the match `params`.
     *
     * @param {String} pathname
     * @return {Object|null} match `params` or null.
     */
    Router.prototype.match = function(pathname) {
        var m = this.rex.exec(pathname);
        // console.log(this.rex, pathname, this.keys, m, this.source)
        var match = null;
        if (m) {
            if (!this.keys) {
                return m.slice(1);
            }
            match = {};
            var keys = this.keys;
            for (var i = 0, l = keys.length; i < l; i++) {
                var value = m[i + 1];
                if (value) {
                    match[keys[i]] = decodeURIComponent(value);
                }
            }
        }
        return match;
    };

    function resolveUrl( /* ...urls */ ) {
        var numUrls = arguments.length

        if (numUrls === 0) {
            throw new Error("resolveUrl requires at least one argument; got none.")
        }

        var base = document.createElement("base")
        base.href = arguments[0]

        if (numUrls === 1) {
            return base.href
        }

        var head = document.getElementsByTagName("head")[0]
        head.insertBefore(base, head.firstChild)

        var a = document.createElement("a")
        var resolved

        for (var index = 1; index < numUrls; index++) {
            a.href = arguments[index]
            resolved = a.href
            base.href = resolved
        }

        head.removeChild(base)

        return resolved
    }

    var ClientRouter = function(options) {
        var self = this;
        options || (options = {});
        _.extend(this, _.pick(options, ["prefix"]));

        this.routes = {};
        this.wares = [];
        this.ewares = [];

        window.onpopstate = function(event) {
            self.navigateTo(document.location.href, {
                back: true
            }, self.errHandler);
        };
    }

    _.extend(ClientRouter.prototype, Events, {
        use: function(ware) {
            if (ware.length == 4)
                this.ewares.push(ware);
            else
                this.wares.push(ware);
        },
        get: function() {
            var route = arguments[0];
            var wares = [];
            for (var i = 1; i < arguments.length; i++) {
                wares.push(arguments[1])
            }
            this.routes[route] = {
                router: new Router(route, false),
                wares: wares
            }
        },
        mutateTo: function(href) {
            var url = resolveUrl(href);
            history.pushState({}, "", url);
        },
        reload: function (opts, cb) {
			this.navigateTo(window.location.pathname, opts, cb);
		},
        navigateTo: function(href, opts, cb) {
            var self = this;

			if (_.isFunction(opts)) {
				cb = opts;
				opts = {}
			}
			opts = opts || {};

            var url = resolveUrl(href);
            var prefix = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + this.prefix
            var uri = url.replace(prefix, "").replace(/\?.*$/, "");
            var match = null;
            var req = {
                query: getQueryStringAsObject(),
                cookies: $.cookie(),
                headers: {
                    'user-agent': navigator.userAgent
                },
                originalUrl: url,
                baseUrl: this.prefix,
                path: uri
            }
            var res = {
                req: req,
                locals: {}
            };
            var stack = [];
            safe.run(function(cb) {
                // execute all normal midlewares
                _.each(self.wares, function(r) {
                    stack.push(function(cb) {
                        r(req, res, cb)
                    })
                });
                safe.series(stack, safe.sure(cb, function() {
                    // now simulate router midleware
                    _.each(self.routes, function(p, k) {
                        if (match) return;
                        match = p.router.match(uri);
                        if (match) {
                            self.trigger("start", {
                                route: k
                            })
                            if (opts.replace)
                                history.replaceState({}, "", url);
                            else if (!opts.back)
                                history.pushState({}, "", url);
                            stack = [];
                            req.params = match;
                            req.route = {
                                path: k
                            };
                            _.each(p.wares, function(r) {
                                stack.push(function(cb) {
                                    r(req, res, cb)
                                })
                            });
                            safe.series(stack, cb);
                        }
                    })
                }))
            }, function(err) {
                if (err) {
                    // finally error handlers
                    stack = [];
                    _.each(self.ewares, function(r) {
                        stack.push(function(cb) {
                            r(err, req, res, cb)
                        })
                    });
                    if (cb) {
						stack.push(function(cb) {
							cb(err)
						})
					}
                    safe.series(stack, function () {});
                } else {
                    // if no match found just do normal
                    // client navigation
                    if (!match)
                        window.location = url;
                }
            })
        }
    })
    return {
        View: View,
        Application: Application,
        Router: ClientRouter
    }
})
