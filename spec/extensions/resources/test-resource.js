const fs = require('fs')
const path = require('path')

module.exports = function testResource () {
  return {
    name: 'test',
    errors: {
      LolzlyNopeError: {
        status: 400,
        data: 'No one likes you.'
      }
    },
    actions: {
      file: {
        method: 'get',
        handle: function (envelope, next) {
          return {
            file: {
              path: 'test.html',
              root: './spec/public'
            }
          }
        }
      },
      fileStream: {
        method: 'get',
        handle: function (envelope, next) {
          const filePath = path.resolve('./spec/public', 'test.html')
          const stream = fs.createReadStream(filePath)
          return {
            file: {
              stream: stream,
              inline: true,
              name: 'stream.html',
              lastModified: new Date(),
              maxAge: 30000
            }
          }
        }
      },
      forward: {
        method: 'get',
        url: 'proxy',
        handle: function (envelope, next) {
          return {
            forward: {
              url: 'http://localhost:8800/test/simple'
            }
          }
        }
      },
      redirect: {
        method: 'get',
        url: '/not/the/droids',
        handle: function (envelope, next) {
          return {
            redirect: {
              url: 'http://localhost:8800/test/simple'
            }
          }
        }
      },
      error: {
        method: 'get',
        url: '/oops',
        handle: function (envelope, next) {
          throwCustom('LolzlyNope')
        }
      },
      defaultError: {
        errors: {
          Error: {
            status: 500,
            data: "This is a default error because I poo'd"
          }
        },
        method: 'get',
        handle: function (envelope, next) {
          throwCustom('Boo')
        }
      },
      serverError: {
        method: 'get',
        handle: function (envelope, next) {
          throwCustom('Uhoh')
        }
      },
      simple: {
        method: 'get',
        handle: function (envelope, next) {
          return {
            data: 'so simple'
          }
        }
      },
      cookies: {
        method: 'get',
        handle: function (envelope, next) {
          return {
            cookies: {
              chocolate: {
                value: 'chip',
                options: {
                  path: '/test/meta',
                  maxAge: 6000
                }
              }
            },
            data: 'cookie monster'
          }
        }
      },
      meta: {
        method: 'get',
        handle: function (envelope, next) {
          return {
            data: envelope.headers
          }
        }
      },
      versioned: {
        method: 'get',
        url: ['lol', 'lulz'],
        handle: [
          {
            when: { route: '/test/lol' },
            then: function (envelope) {
              return { data: ':D' }
            }
          },
          {
            when: { route: '/test/lulz' },
            then: function (envelope) {
              return { data: ':F' }
            }
          }
        ]
      }
    }
  }
}

function throwCustom (error, message) {
  const E = function (message) {
    this.name = error + 'Error'
    this.message = message || error
    this.stack = (new Error()).stack
  }
  E.prototype = Object.create(Error.prototype)
  E.prototype.constructor = E
  throw new E()
}
