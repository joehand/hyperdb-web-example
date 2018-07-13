var css = require('sheetify')
var choo = require('choo')
var hyperdb = require('hyperdb')
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
    if (state.route === '/') return initDb()
    if (state.params.key) return connectDb(state.params.key)
  })

  function initDb () {
    var db = hyperdb(ram)
    db.on('ready', function () {
      console.log(db.key.toString('hex'))
      db.put('hello', 'world', function (err) {
        if (err) return console.error(err)
        console.log('wrote')
      })

      var sw = swarm(signalhub(db.discoveryKey.toString('hex'), ['http://localhost:8000']))
      sw.on('peer', function (conn) {
        console.log('peer')
        pump(conn, db.replicate(), conn)
      })
    })
  }

  function connectDb (key) {
    var db = hyperdb(ram, key)

    db.on('ready', function () {
      console.log(db.key.toString('hex'))
      db.get('hello', function (err, val) {
        if (err) return console.error(err)
        console.log('got', val)
      })

      var sw = swarm(signalhub(db.discoveryKey.toString('hex'), ['http://localhost:8000']))
      sw.on('peer', function (conn) {
        console.log('peer')
        pump(conn, db.replicate(), conn)
      })
    })
  }
})

app.route('/', require('./views/main'))
app.route('/:key', require('./views/404'))

module.exports = app.mount('body')
