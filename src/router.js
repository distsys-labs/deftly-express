var _ = require( "lodash" );
var httpFn = require( "./http" );
var segmentRgx = /(^[\/\\ ])|([\/\\ ]$)/;
var duplicateRgx = /[\/\\]{2}/g;
var hostname = require( "os" ).hostname();

function createContext( state, action, resource ) {
	var url = getUrl( state, resource, action );
	var method = action.method ? action.method.toLowerCase() : "all";
	state.express[ method ] ( 
		url, 
		setContext.bind( null, action, resource )
	);
}

function createRoute( state, deftly, http, action, resource ) {
	var url = getUrl( state, resource, action );
	var method = action.method || "all";
	state.log.debug( "route - %s %s -> %s:%s", 
		method,
		url,
		resource.name,
		action.name
	);
	state.express[ method.toLowerCase() ]( url, function( req, res ) {
		var envelope = getEnvelope( action, resource, req );
		deftly.handle( envelope )
			.then( 
				function( reply ) {
					http.respond( req, res, reply );
				},
				function( error ) {
					// only called if no error strategy was available
					res.send( 500, "Server Error" );
				}
			);
	} );
}

function createRoutes( state, deftly ) {
	var http = httpFn( state );
	deftly.forEachAction( createContext.bind( null, state ) );
	state.express.use( telemetry.bind( null, state, deftly ) );
	deftly.forEachAction( createRoute.bind( null, state, deftly, http ) );
}

function getEnvelope( action, resource, req ) {
	// again oversimplified, but it'll do
	var env =  {
		transport: "http",
		action: action.name,
		resource: resource.name,
		body: req.body || {},
		data: req.body || {},
		query: req.query || {},
		params: req.params || {},
		headers: req.headers || {},
		route: req.url,
		user: req.user,
		cookies: req.cookies
	};

	[ req.params, req.query ]
		.forEach( function( source ) {
			Object.keys( source ).forEach( function( key ) {
				var val = source[ key ];
				if ( !_.has( env.data, key ) ) {
					env.data[ key ] = val;
				}
				if ( !_.has( env.params, key ) ) {
					env.params[ key ] = val;
				}
			} );
		} );
	return env;
}

function getUrl( state, resource, action ) {
	if( action.url && /^[\/]/.test( action.url ) ) {
		return action.url.replace( duplicateRgx, "/" );
	} 
	var parts = [ 
		state.config.urlPrefix || "",
		state.config.apiPrefix || "",
		resource.urlPrefix || resource.name,
		action.url || action.name
	];
	return _.map( parts, prepSegment )
		.join( "/" )
		.replace( duplicateRgx, "/" );
}

function prepSegment( segment ) {
	return segment.replace( segmentRgx, "" );
}

function setContext( action, resource, req, res, next ) {
	req.metricKey = [ resource.name, action.name, "http" ];
	next();
}

function telemetry( state, deftly, req, res, next ) {
	var ip;
	if( req.meaured ) {
		next();
		return;
	}
	req.measued = true;
	// for some edge cases, trying to access the ip/ips property
	// throws an exception, this work-around appears to avoid the
	// need to rely on try/catch
	if ( req.app ) {
		ip = req.ips.length ? req.ips[ 0 ] : req.ip ;
	} else {
		ip = req.headers[ "X-Forwarded-For" ] || req.socket.remoteAddress;
	}
	res.setMaxListeners( 0 );
	var metricKey = req.metricKey || [ req.url.replace( /[\/]/g, "-" ) ];
	var timer = deftly.metrics.timer( metricKey.concat( "duration" ) );
	var requests = deftly.metrics.meter( metricKey.concat( "requests" ), "count" );
	var ingress = deftly.metrics.meter( metricKey.concat( "ingress" ), "bytes" );
	var egress = deftly.metrics.meter( metricKey.concat( "egress" ), "bytes" );
	var method = req.method.toUpperCase();
	var startingSent = req.socket.bytesWritten;
	var startingRead = req.socket.bytesRead;
	res.once( "finish", function() {
		var user = _.isObject( req.user ) ? ( req.user.name || req.user.username || req.user.id ) : "anonymous";
		var read = req.socket.bytesRead - startingRead;
		var readKB = read / 1024;
		var code = res.statusCode;
		var message = res.statusMessage;
		var sent = req.socket.bytesWritten - startingSent;
		var sentKB = sent ? sent / 1024 : 0;
		var url = req.url;
		var elapsed = timer.record( { name: "HTTP_API_DURATION" } );
		requests.record( 1, { name: "HTTP_API_REQUESTS" } );
		ingress.record( read, { name: "HTTP_API_INGRESS" } );
		egress.record( sent, { name: "HTTP_API_EGRESS" } );

		state.log.info( "%s@%s %s (%d ms) [%s] %s %s (%d KB) %s %s (%d KB)",
			process.title,
			hostname,
			ip,
			elapsed,
			user || "anonymous",
			method,
			url,
			readKB,
			code,
			message || "",
			sentKB
		);
	} );
	next();
}

module.exports = function createRouter( state ) {
	return {
		createRoute: createRoute.bind( null, state.app ),
		createRoutes: createRoutes.bind( null, state ),
		getEnvelope: getEnvelope,
		getUrl: getUrl.bind( null, state ),
		prepSegment: prepSegment,
		setContext: setContext
	};
}