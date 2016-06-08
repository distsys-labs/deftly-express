## deftly-express
A minimal HTTP transport based on express. 

## Configuration
The configuration block should show up in the service's configuration block under the `http` property. 

Defaults shown:
```js
{
	http: {
		port: 8800,
		apiPrefix: "/api", // prefixes all API calls
		urlPrefix: "", // prefixes all URLs
		configure: undefined, // a callback to configure express
		postRouting: undefined // a callback to perform any final express configuration 
	}
}
```

### Configuring Express
The `configure` property takes a function that returns a promise. The argument passed to it will have an `express` property with a reference to the express app instance and a `request` property with a reference to the request instance used when forwarding requests. A `config` property will also be on the argument that has access to the `http` configuration block.

This function is called *before* the routes for the resources and actions get created. It allows you to have complete control over how express is configured and any additional middleware. This library does not include any middleware.

example
```js
// simple example showing adding cookie parser middleware
function expressConfig( state ) {
	var app = state.express;
	app.use( "/", require( "cookie-parser" )() );
	return when(); // if the function is asynchronous, it must return a promise
}
```

### Final Configuration
In some cases, there may be express configuration that needs to wait until after deftly-express has supplied the resource action's routes to express. This callback works exactly like the `configure` callback but is invoked after those routes have been supplied. 

## Routing
This module builds routes using a number of configuration values as well as properties on the resource and action.

### Method
Each action is expected to specify the HTTP method via a `method` property. When this property is missing on the action, *all* methods will be used.

### URLs
URLs can be specified in one of two ways; with an explicit URL or a relative one. Explicit URLs are very simple, if the `url` property begins with a `/`, then that exact path will be used for the action's URL.

Relative URLs are comprised of a number of possible values in the following order:

 * http.urlPrefix - config property, defaults to ""
 * http.apiPrefix - config property, defaults to "/api"
 * resource.urlPrefix - resource property, defaults to the resource's name
 * action.url - action property, defaults to action's name

## Responses

```javascript
// defaults shown
{
	status: 200,
	data: undefined,
	cookies: {}, // set cookies sent back to the client
	headers: {}, // set headers sent back in the response
	file: { // only used when replying with file
		[name]: , // the file name for the response
		[type]: , // the content-type
		[path]: , // path to the file to return
		[maxAge]: 0, // cache control header (milliseconds)
		[root]: '', // root directory for relative path
		[lastModified]: true, // sets Last-Modified header based on file system
		[inline]: false, // when true, no user dialog will appear
		[stream]: ,// a stream to pipe to the response
	},
	stream: { // used when sending back a stream
		[type]: , // content-type, defaults to octet-stream
		stream:
	},
	forward: { // only used if forwarding the request
		url: , // the url to forward to
		[method]: , // if unspecified, copies the method of the original request
		[headers]: , // if unspecified, copies headers in the original request
		[body]: // use if changing the body contents
	},
	redirect: { // only used when redirecting
		[status]: 302, // use to set a status other than 302
		url: // the URL to redirect to
	},
	view: "viewName"
}
```

### headers
A simple way to include HTTP headers in the response. There's nothing more to this than key/value pairs.

### cookies
The cookies hash uses key value pairs where each value is a hash with a `value` and an `options` property. Options are ... optional and use the same options as Express does. They are repeated here for convenience:

```js
//  all properties are optional, defaults shown:
{
	domain: [app domain name], // the domain the cookie is valid for
	encode: encodeURIComponent, // used to encode cookie value
	expires: Date, // date when cookie expires (GMT)
	maxAge: '', // relative expiration in milliseconds
	path: '/', // where cookie applies
	httpOnly: false, // only web sever has access
	secure: false, // https only
	signed: false // indicates cookie should be signed
}
```

### file
There are several ways to return a file as the response. 

#### with path to a file
If providing a path to the file, the `stream` property is not used and the `name` and `type` are optional as they can often be determined from the file itself.

#### with stream as a file
If providing a `stream`, the `type` and `name` cannot be inferred; type will default to octet-stream and the file name will be blank. The `lastModified` property should be a date instead of a boolean if you wish to have the `Last-Modified` header set for you.

### forward
This is effectively the same as proxying a request for the user. The `method`, `headers` and `body` are all copied from the original request but can be over-ridden thus giving the action the opportunity to do just about anything required.

### redirect
Very simply way to respond with a redirect. The status defaults to a 302 if one is not specified.

### stream
A simpler version of the file response but will simply send a stream back. The `type` cannot be inferred and so `octet-stream` is the only default value that will ever be supplied if one is not specified.