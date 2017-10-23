const _ = require('fauxdash')
const httpFn = require('./http')
const segmentRgx = /(^[/\\ ])|([/\\ ]$)/
const duplicateRgx = /[/\\]{2}/g
const hostname = require('os').hostname()

function createContext (state, action, resource) {
  const urls = getUrls(state, resource, action)
  const method = action.method ? action.method.toLowerCase() : 'all'
  _.each(urls, url => {
    state.express[ method ](
      url,
      setContext.bind(null, action, resource)
    )
  })
}

function createRoute (state, deftly, http, action, resource) {
  const urls = getUrls(state, resource, action)
  _.each(urls, (url) => {
    const method = action.method || 'all'
    state.log.debug('route - %s %s -> %s:%s',
      method,
      url,
      resource.name,
      action.name
    )
    state.express[ method.toLowerCase() ](url, (req, res) => {
      const envelope = getEnvelope(action, resource, req)
      deftly.handle(envelope)
        .then(
          reply => {
            http.respond(req, res, reply)
          },
          () => {
            // only called if no error strategy was available
            res.send(500, 'Server Error')
          }
        )
    })
  })
}

function createRoutes (state, deftly) {
  var http = httpFn(state)
  deftly.forEachAction(createContext.bind(null, state))
  state.express.use(telemetry.bind(null, state, deftly))
  deftly.forEachAction(createRoute.bind(null, state, deftly, http))
}

function getEnvelope (action, resource, req) {
  // again oversimplified, but it'll do
  const env = {
    transport: 'http',
    action: action.name,
    resource: resource.name,
    body: req.body || {},
    data: req.body || {},
    query: req.query || {},
    params: req.params || {},
    headers: req.headers || {},
    route: req.url,
    user: req.user,
    cookies: req.cookies,
    request: req,
    signout: () => {
      if (req.logout) {
        req.logout()
      }
      if (req.session && req.session.destroy) {
        req.session.destroy()
      }
    }
  };

  [ req.params, req.query ]
    .forEach(source => {
      Object.keys(source).forEach(key => {
        var val = source[ key ]
        if (!has(env.data, key)) {
          env.data[ key ] = val
        }
        if (!has(env.params, key)) {
          env.params[ key ] = val
        }
      })
    })
  return env
}

function getUrls (state, resource, action) {
  if (!action.url || _.isString(action.url) || (action.url && action.url.test)) {
    return [ getUrl(state, resource, action, action.url) ]
  } else {
    return _.map(action.url, getUrl.bind(null, state, resource, action))
  }
}

function getUrl (state, resource, action, actionUrl) {
  if (actionUrl && /^[/]/.test(actionUrl)) {
    return actionUrl.replace(duplicateRgx, '/')
  }
  const parts = [
    state.config.urlPrefix || '',
    state.config.apiPrefix || '',
    resource.urlPrefix || resource.name,
    actionUrl === undefined ? action.name : actionUrl
  ]
  return parts.map(prepSegment)
    .join('/')
    .replace(duplicateRgx, '/')
}

function has (obj, key) {
  return obj && obj[key] !== undefined
}

function prepSegment (segment) {
  return segment.replace(segmentRgx, '')
}

function setContext (action, resource, req, res, next) {
  req.metricKey = [ resource.name, action.name, 'http' ]
  next()
}

function telemetry (state, deftly, req, res, next) {
  var ip
  if (req.measured) {
    next()
    return
  }
  req.measured = true
  // for some edge cases, trying to access the ip/ips property
  // throws an exception, this work-around appears to avoid the
  // need to rely on try/catch
  if (req.app) {
    ip = req.ips.length ? req.ips[ 0 ] : req.ip
  } else {
    ip = req.headers[ 'X-Forwarded-For' ] || req.socket.remoteAddress
  }
  res.setMaxListeners(0)
  const metricKey = req.metricKey || [ req.url.replace(/[/]/g, '-') ]
  const timer = deftly.metrics.timer(metricKey.concat('duration'))
  const requests = deftly.metrics.meter(metricKey.concat('requests'), 'count')
  const ingress = deftly.metrics.meter(metricKey.concat('ingress'), 'bytes')
  const egress = deftly.metrics.meter(metricKey.concat('egress'), 'bytes')
  const method = req.method.toUpperCase()
  const startingSent = req.socket.bytesWritten
  const startingRead = req.socket.bytesRead
  res.once('finish', () => {
    const user = _.isObject(req.user) ? (req.user.name || req.user.username || req.user.id) : 'anonymous'
    const read = req.socket.bytesRead - startingRead
    const readKB = read / 1024
    const code = res.statusCode
    const message = res.statusMessage || ''
    const sent = req.socket.bytesWritten - startingSent
    const sentKB = sent ? sent / 1024 : 0
    const url = req.url
    const elapsed = timer.record({ name: 'HTTP_API_DURATION' })
    const processTag = `${process.title}@${hostname}`
    requests.record(1, { name: 'HTTP_API_REQUESTS' })
    ingress.record(read, { name: 'HTTP_API_INGRESS' })
    egress.record(sent, { name: 'HTTP_API_EGRESS' })

    state.log.info(
      `${processTag} ${ip} (${elapsed} ms) ${user} ${method} ${url} (${readKB} KB) ${code} ${message} (${sentKB} KB)`
    )
  })
  next()
}

module.exports = function createRouter (state) {
  return {
    createRoute: createRoute.bind(null, state.app),
    createRoutes: createRoutes.bind(null, state),
    getEnvelope: getEnvelope,
    getUrl: getUrl.bind(null, state),
    prepSegment: prepSegment,
    setContext: setContext
  }
}
