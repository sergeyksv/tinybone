# Tiny(back)Bone Dual rendering simplistic backbone alike library

TinyBone is inspired by dual rendering Rendr framework and some custom made solutions.
Rendr is BackBone derivered library for dual rendering. Dual rendering itself is
the ability to render pages equally well both on client and server.

Dual rendering is approach that join classic web apps and client based (aka SPA).
Same application code allows to render html on server and send it to browser so
it will show page presentation right away. Special technique is used to make this
static content alive (bind JS). So for first page load dual app behaves as classic apps.
However all further navigation can be performed client side. Code that does client
and server rendering is literally the same. Any page can be refreshed at any time
and user didn't notice the difference between server side and client side rendering.

Good question here why to have dual rendering? We do believe that this provide
such benefits as:
* Ability to effectively use client side or CDN cache. Why, because caching of final
content (html) can be tricky, while caching of API calls is something natural.
* Faster navigation when application and API designed properly. The last phrase
is important. Client side rendering might be slower and even likely will be slower
if not designed properly.
* Proper API design. As we stated above we should do it otherwise app will be slow.
Why it is benefit? Because properly designed API will be effective for 3rd apps
(like Native) ad we'll have it out of the box and in very optimal way
* No code duplication for dynamic AJAX updates

How TinyBone is different from Rendr?

* TinyBone client router mimics and upward compatible with Express.JS router.
So application routes looks to be exactly the same as though this is normal
Express.JS app
* TinyBone template engine is Dust.JS. We do believe that Dust.JS is better
than Hogan. Specifically it is asynchronous, supports context bubbling,
more predictable and easily extensible.
* TinyBone is friendly for development. It is based on Require.JS and
you can develop you app as set of JS files that will be loaded upon request and
implement final build that will package your app in most effective way.
* TinyBone is not depends or use BackBone. It uses lot of BackBone ideas
but changes some parts in radical way in order to better suite project needs.
* TinyBone is only View layer and client Router. It doesn't enforce data models,
backend type and structure etc.

For example application please please see:
* https://github.com/sergeyksv/tinyapp-bootstrap
* https://github.com/sergeyksv/tinelic

## Application

Application is base class/object that any final application should subclass.
Essentially this is just root object of entire application hierarchy and it is
passed to all descendant objects.

* `_t_prefix` - uri prefix this application is running on (like /web)
* `_t_app` - any object  will have that property to be set
* `getTplCtx(cb(err,dustContext))` - optionally over loadable function that is
used to fill the base data context

## View

View is chunk of DOM models and JS code associated with it.

### Attributes

* `tagName` - tag name used to render root element of view (default is div)
* `$` - helper function that can be used to lookup elements inside this view
* `app` - Application object this view is belong to
* `parent` - Parent view when available
* `views[]` - Child views
* `cid` - Unique view id
* `name` - Logical view name.
* `locals` - Data context for local data (usually populated by view itself).
Consider it as local views state
* `data` - Render time provided data context (usually populated by app).

### Life Cycle hooks
* `postRender` - called when view is rendered on client. Good place to initialize
any client side JS componebts
* `postAlive` - called when all views are rendered and linked all together. Can
be used to traverse in view tree and bind to any of linked views.
* `postTransplant` - called when view is moved from one view to another. This
operation is called 'transplant'.
* `preRender` - called before rendering and can be used to apply any custom data
transformation on `this.locals` before passing then to template engine

### API

* `bindDom($dom,$donor,globals)` - bind DOM model that is correspond to view.
By default view renders text. This text can be used on server to return html
context. On client it can be used to dynamically inject it to DOM model. After
text is transformed to DOM view need to be linked/bound with this DOM.
`$donor` view is optional and can be used as optimization strategy to reuse
some of subview of existing view which is supposed to be dismissed. As an example
think about web app that uses map on the background for all pages of the site.
It is relatively heavy to recreate map view, but it is easy to reuse it.
* `attachSubView(view)` - attach live view to parent one. This is only logical
linkage and there is assumption that DOM model is also include child view.
* `detachSubView(view)` - opposite to attach
* `render(cb(text))` - render view as text. Note that rendering changes view
itself to match rendered text. This include some internal attributes and plus
chile view hierarchy.
* `refresh(cb(view))` - refreshes view in place by creating of new view that
replaces current one
* `remove` - remove view and its DOM module along with child views
* `removeChilds` - remove subviews
* `get(key, defValue)` - function to get variable from view context programmatically
* `setState(state,value)` - helper function to associate value with states
* `stateEvent(state)` - state transition
* `getViewByName(name, opts)` - Used to find view nearby of certain name

### Internals (usually not called directly)

* `bindWire` - used to attach wire (data associated with view) to already
available DOM model. Used to "alive" DOM module rendered on server.
* `getWire` - package data that are associated with view (and its childs)
* `getTplCtx(cb(ctx))` - by convension this function return base context for view rendering.
Default behavior is traverse up in view tree up to root element and then populate
context from upper level element to lower level
* `populateTplCtx(ctx, cb(ctx)` - used to populate context with data for this specific view.
Default behavior is to include into content view itself (as `_t_view`) and then
add data layer on top of `this.locals` and then on `this.data`
* `setElement` - changes view root element including events re-delegation
* `delegateEvents` - bind events and handlers to root element maps based on `this.events`
* `undelegateEvents` - unbinds any bound events

## Router

Router object support ExpressJS alike `use`, `get`, `reload` functions.

Router populate content of Request and Response object in Express.JS compatible manner.

Request object include following attributes:

* `query` - GET params
* `cookies` - cookies
* `headers` - only `user-agent` is provide
* `originalUrl`
* `baseUrl`
* `path`
* `_t_start` - Start of navigation (Date)

Response object include following attributes:

* `req` - Request
* `cookie` - Cookies to "set"
* `locals` - Locals object to be populated by middlewares
