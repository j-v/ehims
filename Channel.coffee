storage = require './storage'
messages = require './messages'
globals = require './globals'

class Channel
  #constructor not to be called: use Channel.create and Channel.load instead
  constructor: (params) ->
    @name = params.name
    @id = params.id

  _ready = false
  _closed = false
  joinedUsers = []

  isReady: -> _ready
  isClosed: -> _closed
  onReady: (callback, timeoutsec = -1, timeoutfn = undefined) ->
    if _ready then callback

    cancel = false
    # set a timer to cancel after timeoutsec seconds
    if timeoutsec? then setTimeout (-> cancel=true), timeoutsec * 1000

    loopUntilReady = ->
      if cancel then timeoutfn()
      else if _ready callback()
      else setTimeout loopUntilReady, 50
    loopUntilReady()

  broadcast: (message) ->
    # message is JSON object. assume it is valid
    # add to each user's message queue. implementation TBD
    for user in joinedUsers
      # don't broadcast to the sender of the message
      if user.id == message.clientId then continue
      user.messageQueue.enqueue message

    #save to storage
    storage.storeMessage message

  addUser: (user) ->
    if (joinedUsers.indexOf user) == -1
      # the user is not already in the channel
      joinedUser.push user
      console.log "#{user.username} joined #{@name}"
      user.channel = this
      message = {
        type: MESSAGE_TYPE_JOIN,
        clientId: user.id,
        clientName: user.name,
        globals.timestamp: globals.timestamp()
      }
      @broadcast message
      return true
    else
      return false
  removeUser: (user) ->
    userIndex = joinedUsers.indexOf user
    if userIndex == -1
      # user is not in the channel
      return false
    else
      message = {
        type: messages.MESSAGE_TYPE_LEAVE,
        clientId: user.id,
        globals.timestamp: globals.timestamp()
      }
      @broadcast message
      return true
  newMessage: (user, parentIds, text) ->
    # TODO validate user
    # validate parent ids?
    message = {
      type: messages.MESSAGE_TYPE_MESSAGE,
      clientId: user.id,
      parentIds: parentIds,
      text: text,
      globals.timestamp: globals.timestamp()
    }
    @broadcast message
    return true

  close: ->
    _closed = true
    console.log "Closing channel: #{@name} ..."

    message = {
      type: messages.MESSAGE_TYPE_CHANNEL_CLOSE,
      globals.timestamp: globals.timestamp()
    }
    @broadcast message

    #set each user's channel to null
    for user in joinedUsers
      user.channel = null

  getUsers: -> joinedUsers.copy()

  # Static methods
  @create: (name, callback) ->
    # assume name has already been checked that it doesn't already exist
    storage.newChannel {name: name}, (err, channelId) ->
      if err?
        callback err, null
      else
        # channel data has been successfully saved to storage, we create a new Channel object
        channel = new Channel {name:name, id: channelId}
        callback null, channel

  @load: (name, callback) ->
    storage.channelExists name, (err, exists) ->
      if err? then callback err, null
      else if not exists then callback 'Channel not found', null
      else
        storage.getChannelName name (err, params) ->
          if err? then callback err, null
          else
            channel = new Channel params
            callback null, channel


module.exports = Channel
