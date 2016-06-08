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
	
	var configure = when();
	var postRouting = () => when();
	if( configuration.configure ) {
		configure = configuration.configure( state );
		if( !configure || !configure.then ) {
			configure = when( configure );
		}
	}
	if( configuration.postRouting ) {
		postRouting = () => {
			var result = configuration.postRouting( state );
			if( !result || !result.then ) {
				result = when( result );
			}
			return result;
		};
	}
	return configure
		.then( state.router.createRoutes.bind( null, deftly ) )
		.then( postRouting );
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
	return Object.assign( {}, state, {
		initialize: initialize.bind( null, state ),
		start: start.bind( null, state ),
		stop: stop.bind( null, state )
	} );
}