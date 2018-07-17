var css = require('sheetify')
var choo = require('choo')
var hypercore = require('hypercore')
var ram = require('random-access-memory')
var signalhub = require('signalhub')
var pump = require('pump')
var swarm = require('webrtc-swarm')

css('tachyons')

var app = choo()
if (process.env.NODE_ENV !== 'production') {
  app.use(require('choo-devtools')())
} else {
  app.use(require('choo-service-worker')())
}

app.use(require('./stores/clicks'))
app.use(function (state, emitter) {
  emitter.on(state.events.DOMCONTENTLOADED, function () {
    if (state.route === '/') return initCore()
    if (state.params.key) return connectCore(state.params.key)
  })

  function initCore () {
    var feed = hypercore(ram)
    feed.on('ready', function () {
      console.log(feed.key.toString('hex'))
      feed.append('hello world', function (err) {
        if (err) return console.error(err)
        console.log('wrote')
      })

      var sw = swarm(signalhub(feed.discoveryKey.toString('hex'), ['http://localhost:8000']))
      sw.on('peer', function (conn) {
        console.log('peer')
        pump(conn, feed.replicate(), conn, function (err) {
          console.error(err)
        })
      })
    })
  }

  function connectCore (key) {
    var feed = hypercore(ram, key)

    feed.on('ready', function () {
      console.log(feed.key.toString('hex'))
      feed.get(0, function (err, val) {
        if (err) return console.error(err)
        console.log('got', val)
      })

      var sw = swarm(signalhub(feed.discoveryKey.toString('hex'), ['http://localhost:8000']))
      sw.on('peer', function (conn) {
        console.log('peer')
        pump(conn, feed.replicate(), conn)
      })
    })
  }
})

app.route('/', require('./views/main'))
app.route('/:key', require('./views/404'))

module.exports = app.mount('body')
