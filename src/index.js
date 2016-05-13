var _ = require( "lodash" );
var when = require( "when" );
var express = require( "express" );
var request = require( "request" );
var http = require( "http" );
var mime = require( "mime" );
var fs = require( "fs" );
var path = require( "path" );
var log;

function initialize( state, deftly ) {
	log = deftly.log.get( "http" );
	state.log = log;
	var configuration = deftly.config.http || {};
	Object.assign( state, {
		config: configuration
	} );
	var reply = when();
	if( configuration.configure ) {
		reply = configuration.configure( state );
		if( !reply.then ) {
			reply = when( reply );
		}
	}
	return reply.then( state.router.createRoutes.bind( null, deftly ) );
}

function start( state ) {
	var port = state.config.port || 8800;
	log.info( "http listener starting at", port );
	state.http.listen( port );
}

function stop( state ) {
	state.http.close();
}

module.exports = function expressTransport() {
	var app = express();
	var state = {
		express: app,
		request: request,
		http: http.createServer( app )
	};
	state.router = require( "./router" )( state );
	return {
		initialize: initialize.bind( null, state ),
		start: start.bind( null, state ),
		stop: stop.bind( null, state )
	};
}