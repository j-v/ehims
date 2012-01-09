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

  channel: null
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
    @timeout = setTimeout User.timeoutFunction, globals.USER_TIMEOUT_DELAY, this

  info: -> {id: @id, name: @name}

  poll: (timeoutMs, callback) ->
    @resetTimeout()
    messages = []
    pollTimer = null
    #setTimeout callback, 2000, null, []
    #return

    pollTerminate = ->
      clearTimeout pollTimer
      callback null, messages
    pollTimeout = setTimeout pollTerminate, timeoutMs

    userQueue = @messageQueue

    pollLoop = ->
      #TODO check if user hasn't been terminated?
      if not userQueue.empty
        clearTimeout pollTimeout
        #while not userQueue.empty
        #  messages.push userQueue.dequeue()

        callback null, userQueue.all()
      else
        pollTimer = setTimeout pollLoop, globals.SERVER_POLL_INTERVAL

    pollLoop() # begin polling

  # Static methods
  @create: (name, callback) ->
    # assume name is valid, has already been checked that it doesn't already exist
    storage.newUser {name: name}, (err, userId) ->
      if err?
        callback err, null
      else
        # channel data has been successfully saved to storage, we create a new Channel object
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

  @timeoutFunction: (user) ->
    console.log "#{user.name} timed out."
    user.kill()

module.exports = User
