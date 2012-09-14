storage = require './storage'
Queue = require './Queue'
globals = require './globals'
{EventEmitter} = require 'events'

class User extends EventEmitter
  # events: disconnect


  # DONT USE CONSTRUCTOR, use User.create and User.load instead
  # params is JSON object {name, id}
  constructor:(params) ->
    #TODO validate params?
    @id = params.id
    @name = params.name
    @resetTimeout()
    @messageQueue = new Queue()

    # Bind to the message queue's "new" event, triggers new messages to be sent to client
    self = this
    @messageQueue.on 'new', (e) -> 
      queue = e.queue
      if self._poller?
        self.resetTimeout()
        #clearTimeout self.pollTimeout
        self._poller queue.all()
        self._poller = null

    @channel = null
    # polling stuff
    @_poller = null      # gets set as a function when client polling, takes messages
    @pollTimeout = null # gets set when poller object is set

  setPoller: (poller) ->
    @resetTimeout()
    @_poller = poller
    self = this
    pollTimeoutFunction = ->
      self._poller []
      self._poller = null

  kill: ->
    clearTimeout @timeout
    if @channel? then @channel.removeUser this
    delete @messageQueue
    #delete users[@id]
    @emit 'disconnect',
      user: this

  timeout: null
  resetTimeout: ->
    clearTimeout @timeout

  # Get user info to be sent to clients who request user information
  info: -> {id: @id, name: @name}

  # Static methods
  @create: (name, callback) ->
    # assume name is valid, has already been checked that it doesn't already exist
    storage.newUser {name: name}, (err, userId) ->
      if err?
        callback err, null
      else
        # User data has been successfully saved to storage,
        # we create a new User object
        user = new User {name:name, id: userId}
        callback null, user

  @load: (name, callback) ->
    # assuming name is valid
    storage.userExists name, (err, exists) ->
      if err? then callback err, null
      else if not exists then callback 'User not found', null
      else
        storage.getUserParams name, (err, params) ->
          if err? then callback err, null
          else
            user = new User params
            callback null, user

  # timeoutFunction: called when user hasn't polled for too long, triggers disconnection
  @timeoutFunction: (user) ->
    console.log "#{user.name} timed out."
    user.kill()

module.exports = User
