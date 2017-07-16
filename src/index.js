const express = require('express')
const request = require('request')
const http = require('http')
var log

function initialize (state, deftly) {
  log = deftly.log.get('http')
  state.log = log
  const configuration = deftly.config.http || {}
  Object.assign(state, {
    config: configuration,
    fount: deftly.fount
  })

  let configure = Promise.resolve()
  let postRouting = () => Promise.resolve()
  if (configuration.configure) {
    configure = configuration.configure(state)
    if (!configure || !configure.then) {
      configure = Promise.resolve(configure)
    }
  }
  if (configuration.postRouting) {
    postRouting = () => {
      let result = configuration.postRouting(state)
      if (!result || !result.then) {
        result = Promise.resolve(result)
      }
      return result
    }
  }
  return configure
    .then(state.router.createRoutes.bind(null, deftly))
    .then(postRouting)
}

function start (state) {
  const port = state.config.port || 8800
  log.info('http listener starting at', port)
  state.http.listen(port)
}

function stop (state) {
  state.http.close()
}

module.exports = function expressTransport () {
  const app = express()
  const state = {
    express: app,
    request: request,
    http: http.createServer(app)
  }
  state.router = require('./router')(state)
  return Object.assign({}, state, {
    initialize: initialize.bind(null, state),
    start: start.bind(null, state),
    stop: stop.bind(null, state)
  })
}
