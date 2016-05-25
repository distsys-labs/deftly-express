var _ = require( "lodash" );
var path = require( "path" );
var fs = require( "fs" );
var mime = require( "mime" );

function forwardTo( req, res, reply ) {
	var options = reply.forward;
	if ( !req.readable ) {
		var original = {
			method: req.method,
			headers: req.headers
		};
		if ( req.body ) {
			original.body = req.body;
			if ( _.isObject( req.body ) ) {
				original.json = true;
			}
		}
		var forwarded = Object.assign( {}, original, options );
		return request( forwarded ).pipe( res );
	} else {
		return req.pipe( request( options ) ).pipe( res );
	}
}

function redirect( res, reply ) {
	var code = reply.statusCode || reply.status || 302;
	setMeta( res, reply );
	res.redirect( code, reply.redirect.url );
}

function replyWith( res, reply ) {
	var code = reply.statusCode || reply.status || 200;
	setMeta( res, reply );
	if( reply.data ) {
		res
			.status( code )
			.send( reply.data );
	} else {
		res.sendStatus( code );
	}
}

function render( res, reply ) {
	var code = reply.statusCode || reply.status || 200;
	setMeta( res, reply );
	res.status( code );
	res.render( reply.view, reply.data );
}

function respond( state, req, res, reply ) {
	if( reply.file ) {
		if( reply.file.path ) {
			sendFile( state, res, reply );
		} else {
			sendFileStream( res, reply );
		}
	} else if( reply.stream ) {
		sendStream( res, reply );
	} else if( reply.redirect ) {
		redirect( res, reply );
	} else if( reply.forward ) {
		forwardTo( req, res, reply );
	} else if ( reply.view ) {
		render( res, reply );
	} else {
		replyWith( res, reply );
	}
}

function sendFile( state, res, reply ) {
	var file = reply.file;
	var code = reply.statusCode || reply.status || 200;
	var headers = reply.headers || {};
	reply.headers = headers;
	res.status( code );
	
	if( !reply.headers[ "Content-Disposition"] && !reply.headers[ "content-disposition" ] ) {
		var filename = file.name || path.basename( file.path );
		var type = "attachment";
		if( file.inline ) {
			type = "inline";
		}
		reply.headers[ "content-disposition" ] = `${type}; filename="${filename}"`;
	}

	var options = {
		headers: reply.headers,
		maxAge : reply.maxAge || file.maxAge || 0,
		lastModified: file.lastModified === undefined ? true : file.lastModified,
		root: path.resolve( file.root || __dirname )
	};

	res.sendFile( file.path, options, function( err ) {
		if( err ) {
			console.log( err );
			state.log.error( `Error sending file ${file.path}: ${err.stack}` );
		}
	} );
}

function sendFileStream( res, reply ) {
	var file = reply.file;
	var code = reply.statusCode || reply.status || 200;
	var headers = reply.headers || {};
	reply.headers = headers;
	headers[ "Content-Type" ] = reply.file.type || mime.lookup( file.name );
	if( file.maxAge ) {
		headers[ "Cache-Control" ] = `maxAge=${file.maxAge}`;
	}
	if( _.isDate( file.lastModified ) ) {
		headers[ "Last-Modified" ] = file.lastModified.toUTCString();
	}
	if( !headers[ "Content-Disposition"] && !headers[ "content-disposition" ] ) {
		var filename = file.name;
		var type = "attachment";
		if( file.inline ) {
			type = "inline";
		}
		headers[ "content-disposition" ] = `${type}; filename="${filename}"`;
	}
	res.status( code );
	setMeta( res, reply );
	reply.file.stream.pipe( res );
}

function sendStream( res, reply ) {
	var code = reply.statusCode || reply.status || 200;
	var headers = reply.headers || {};
	reply.headers = headers;
	headers[ "Content-Type" ] = reply.content || reply.type || "application/octet-stream";
	res.status( code );
	setMeta( res, reply );
	reply.stream.pipe( res );
}

function setMeta( res, reply ) {
	if ( reply.headers ) {
		res.set( reply.headers );
	}
	if ( reply.cookies ) {
		_.each( reply.cookies, function( v, k ) {
			res.cookie( k, v.value, v.options );
		} );
	}
}

module.exports = function( state ) {
	return {
		forwardTo: forwardTo,
		redirect: redirect,
		replyWith: replyWith,
		respond: respond.bind( null, state ),
		sendFile: sendFile,
		sendFileStream: sendFileStream,
		sendStream: sendStream,
		setMeta: setMeta
	};
};
