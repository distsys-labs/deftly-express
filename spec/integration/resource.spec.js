require('../setup')
const deftly = require('deftly')
const moment = require('moment')
const axios = require('axios')
const fs = require('fs')

describe('Deftly Service', function () {
  let service
  before(function () {
    return deftly.init({
      middleware: ['./spec/extensions/middleware/*.js'],
      plugins: ['./spec/extensions/plugins/*.js'],
      resources: ['./spec/extensions/resources/*-resource.js'],
      transports: ['./src/index.js'],
      http: {
        configure: function (state) {
          state.express.use('/', function (req, res, next) {
            res.set('x-lol', 'roflcoptor')
            next()
          })
          // simply put here to demonstrate that the deftly fount
          // instance is now available to the configure context
          return state.fount('resources').resolve('testResource')
        }
      }
    })
      .then(function (svc) {
        service = svc
        svc.start()
      })
  })

  describe('when retrieving file', function () {
    let fileContent, headers
    before(function () {
      return axios.get(
        'http://localhost:8800/test/file',
        {}
      ).then((resp) => {
        fileContent = resp.data
        headers = resp.headers
      })
    })

    it('should retrieve file contents with correct headers', function () {
      const verify = fs.readFileSync('./spec/public/test.html').toString('utf8')
      fileContent.should.eql(verify)
    })

    it('should include expected headers', function () {
      headers['content-disposition'].should.eql('attachment; filename="test.html"')
      headers.should.have.property('cache-control')
      headers.should.have.property('last-modified')
      headers.should.have.property('etag')
      headers.should.have.property('x-lol')
    })
  })

  describe('when retrieving stream as a file', function () {
    let fileContent, headers
    before(function () {
      return axios.get(
        'http://localhost:8800/test/fileStream',
        {}
      ).then((resp) => {
        fileContent = resp.data
        headers = resp.headers
      })
    })

    it('should retrieve file contents with correct headers', function () {
      const verify = fs.readFileSync('./spec/public/test.html').toString('utf8')
      fileContent.should.eql(verify)
    })

    it('should include expected headers', function () {
      headers['content-disposition'].should.eql('inline; filename="stream.html"')
      headers.should.have.property('cache-control')
      headers.should.have.property('last-modified')
      headers.should.have.property('x-lol')
    })
  })

  describe('when calling an endpoint with a custom error', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/oops',
        {}
      ).catch((err) => {
        body = err.response.data
        status = err.response.status
      })
    })

    it('should get correct status code and error message', function () {
      status.should.equal(400)
      body.should.eql('No one likes you.')
    })
  })

  describe('when calling an endpoint with a fallback error', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/defaultError',
        {}
      ).catch((err) => {
        body = err.response.data
        status = err.response.status
      })
    })

    it('should get correct status code and error message', function () {
      status.should.equal(500)
      body.should.eql("This is a default error because I poo'd")
    })
  })

  describe('when calling an endpoint with no custom error', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/serverError',
        {}
      ).catch((err) => {
        body = err.response.data
        status = err.response.status
      })
    })

    it('should get correct status code and error message', function () {
      status.should.equal(500)
      body.should.eql("An unhandled error of 'UhohError' occurred at test - serverError")
    })
  })

  describe('when hitting simple endpoint', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/simple',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get correct status code and response body', function () {
      status.should.equal(200)
      body.should.eql('so simple')
    })
  })

  describe('when hitting URL with multiple routes - first route', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/lol',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get handler mapped to first route', function () {
      status.should.equal(200)
      body.should.eql(':D')
    })
  })

  describe('when hitting URL with multiple routes - second route', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/lulz',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get handler mapped to second route', function () {
      status.should.equal(200)
      body.should.eql(':F')
    })
  })

  describe('when calling a forwarded action', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/proxy',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get correct status code and response body', function () {
      status.should.equal(200)
      body.should.eql('so simple')
    })
  })

  describe('when calling a redirected action', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/not/the/droids',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get correct status code and response body', function () {
      status.should.equal(200)
      body.should.eql('so simple')
    })
  })

  describe('when getting cookies', function () {
    let body, status, cookies
    before(function () {
      return axios.get(
        'http://localhost:8800/test/cookies',
        {}
      ).then((resp) => {
        body = resp.data
        status = resp.status
        cookies = resp.headers['set-cookie']
      })
    })

    it('should get correct status code and response body', function () {
      status.should.equal(200)
      body.should.eql('cookie monster')
      var utc = new moment().add(6, 'seconds').toDate().toUTCString() // eslint-disable-line
      cookies.should.eql([`chocolate=chip; Max-Age=6; Path=/test/meta; Expires=${utc}`])
    })
  })

  describe('when getting headers back', function () {
    let body, status
    before(function () {
      return axios.get(
        'http://localhost:8800/test/meta',
        {
          headers: {
            one: 1,
            two: 'b',
            three: 'a; b; c'
          }
        }
      ).then((resp) => {
        body = resp.data
        status = resp.status
      })
    })

    it('should get correct status code and response body', function () {
      status.should.equal(200)
      body.should.eql({
        one: '1',
        two: 'b',
        three: 'a; b; c',
        host: 'localhost:8800',
        connection: 'close',
        accept: 'application/json, text/plain, */*',
        'user-agent': 'axios/0.21.1'
      })
    })
  })

  after(function () {
    service.stop()
  })
})
