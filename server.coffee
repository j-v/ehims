express = require 'express'
storage = require './storage'
messages = require './messages'
globals = require './globals'
Channel = require './Channel'
User = require './User'


users = {}      # stores all online users. Keys are user IDs, values User objects
channels = {}   # stores all active channels. keys are channel names

###
Add a user to the server's collection of Users 
The User will be officially "connected"
Beware of ambiguity with Channel.addUser TODO
###
addUser = (user) -> users[user.id] = user

###
Remove user from the server's collection of Users
User will be "disconnected"
Beware of ambiguity with Channel.removeUser TODO
###
removeUser = (user) -> delete users[user.id]

# TODO remove this, it appears to be unused
#addChannel = (channel) -> channels[channel.id] = channel

# Returns true if a user with specified username is connected
userConnected = (username) ->
  for id,user of users
    return true if user.name == username
  return false

# Loads a user of the specified username from the database
# If user is already connected, calls back with an error
# If the user is not found in the database, it is created
# TODO move to User.coffee ?
getUser = (name, callback) ->
  # loads user or creates if doesn't exist
  # check name not taken
  if userConnected name
    callback 'Username taken', null
  else
    # try loading existing client, otherwise create new one.
    User.load name, (err, loadedUser) ->
      if not err?
        callback null, loadedUser
      else
        # assume error means user doesn't exist yet
        User.create name, (err, newUser) ->
          if not err?
            callback null, newUser
          else
            callback err, null

            
app = express.createServer()

app.configure ->
  app.set 'views', __dirname + '/views'
  app.set 'view engine', 'jade'
  app.use express.bodyParser()
  app.use express.static(__dirname + '/public')

app.configure 'development', ->
  app.use express.errorHandler
    dumpException: true
    showStack: true

app.configure 'production', ->
  app.use express.express()

# handle request to landing page
app.get '/', (req, res) ->
  res.render 'client'
    layout: false

# handle connect request
app.post '/connect', (req, res) ->
  res.contentType 'application/json'

  name = req.body.name                  # name of user wishing to connect
  requestId = req.body.requestId
  if not name? or not requestId?        # must have both name & request ID
    res.send
      requestId: requestId
      success: 'n'
      err: 'Missing parameter(s)'
  else

    getUser name, (err, user) ->        # attempt to load or create the user

      if err? then res.send             # send response indicating failure to client
        success: 'n'
        requestId: requestId
        err: err
      else
        console.log 'Got user ' + user.name

        addUser user

        user.on 'disconnect', (e) ->    # bind to user disconnect event
          console.log "#{e.user.name} disconnected"
          removeUser e.user

        res.send                        # send response to client
          success: 'y'
          requestId:requestId
          clientId: user.id



# TODO remove this?
app.get '/channels', (req, res) ->
  throw globals.notImplementedError

# handle request to join channel
app.post '/join', (req, res) ->
  res.contentType 'application/json'

  # parse request parameters
  channelName = req.body.channelName
  requestId = req.body.requestId
  userId = req.body.clientId

  if not channelName? or channelName == '' then channelName = globals.DEFAULT_CHANNEL_NAME

  if not requestId? or not userId?
    res.send                    # missing parameters, send failure response
      requestId: requestId
      success: 'n'
      clientId: userId
      err: 'Missing parameter(s)'
  else
    # check user connected
    user = users[userId]
    if not user?
      res.send                  # user not connected, send failure response
        requestId: requestId
        success: 'n'
        clientId: userId
        err: 'Invalid client ID'
    else
      # callback to send success response, triggered channel is loaded
      channelReady = (channel) ->
        channel.addUser user
        res.send
          requestId: requestId
          clientId: userId
          channelName: channel.name
          success: 'y'

      # Check if the requested channel is active
      channel = channels[channelName]
      if not channel?   # Channel is not currently active
        # Try to load channel, otherwise create it
        console.log "trying to load channel #{channelName}"
        Channel.load channelName, (err, loadedChannel) ->
          if not err? # channel loaded successfully
            console.log "Channel #{channelName} loaded"
            channels[channelName] = loadedChannel
            channelReady loadedChannel
          else
            # create it (assuming error means channel doesn't  exist..)
            console.log "Creating channel #{channelName}"
            Channel.create channelName, (err, newChannel) ->
              if not err? # channel created
                console.log "Channel #{channelName} created"
                channels[channelName] = newChannel

                newChannel.on 'close', (channel) -> # bind to channel close event
                  delete channels[channel.name]     # remove from active channels

                channelReady newChannel             # trigger callback
              else
                res.send        # error loading channel, send failure response
                  requestId: requestId
                  clientId: userId
                  success: 'n'
                  err: 'Unable to join channel, try again.'
      else
        console.log "Channel #{channelName} active, joining..."
        channelReady channel    # trigger callback



# handle /clients request
app.get '/clients', (req, res) -> # get active users in a channel
  # parse request parameters
  requestId = req.query.requestId
  userId = req.query.clientId
  channelName = req.query.channelName

  if not requestId? or not userId?
    res.send    # missing parameters, send failure response
      requestId: requestId
      clientId: userId
      success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId]        # retrieve User object with specified ID

    # callback to send response, triggered once the user's channel is determined
    getUsers = (channel) ->
      # get Array of User info
      channelUsers = (user.info() for user in channel.getUsers())
      res.send
        requestId: requestId, clientId: userId, success: 'y'
        clients: channelUsers

    if not channelName? and not user.channel?
      res.send
        requestId: requestId, clientId: userId, success: 'n',
        err: 'No channel specified, and client is not in a channel'
    else if not channelName?
      # use user's active channel
      getUsers user.channel # trigger callback
    else
      channel = channels[channelName]
      if channel?
        getUsers channel # trigger callback
      else
        res.send
          requestId: requestId, clientId: user.id, success: 'n'
          err: 'Channel not active'

# handle /history request
app.get '/history', (req, res) ->
  res.contentType 'application/json'

  requestId = req.query.requestId
  userId = req.query.clientId
  channelName = req.query.channelName

  if not requestId? or not userId?
    res.send
      requestId: requestId
      clientId: userId
      success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId] # TODO validate user?

    # callback to send response, triggered when have the channel to get messages from
    getMessages = (channel) ->
      console.log "getting messages for channel #{channel.name}"
      storage.getAllMessages channel.id, (err, messageList) ->
        if err?
          res.send
            requestId: requestId, clientId: user.id, success: 'n',
            err: 'Error retrieving message history'
        else
          #console.log messageList
          res.send
            requestId: requestId, clientId: user.id, success: 'y', msgs: messageList
          for i in [0..messageList.length-1]
            delete messageList[i]

    # get the channel we want to retrive history from
    if not channelName? and not user.channel?
      res.send
        requestId: requestId, clientId: userId, success: 'n',
        err: 'No channel specified, and client is not in a channel'
    else if not channelName?
      # use user's active channel
      channel = user.channel
      getMessages channel
    else
      channel = channels[channelName]
      getMessages channel # trigger callback
      if not channel?
        res.send
          requestId: requestId, clientId:clientId, success: 'n',
          err: 'Specified channel does not exist.'
      else
        getMessages channel # trigger callback

# handle /poll request
app.get '/poll', (req, res) ->
  res.contentType 'application/json'

  requestId = req.query.requestId
  userId = req.query.clientId

  if not requestId? or not userId?
    res.send
      requestId: requestId
      clientId: userId
      success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId:userId, success: 'n',
        err: 'Invalid client ID'
    else
      timeoutSec = Number(req.query.timeout)

      timeoutMs = if timeoutSec? and timeoutSec < (globals.USER_MAX_POLL_TIME / 1000)
        timeoutSec * 1000
      else
        globals.USER_MAX_POLL_TIME

      console.log "#{user.name} polling"

      # Set the user's "poller" callback, which is triggered when new messages come in
      user.setPoller (messages) ->
        console.log "#{user.name} polled"
        res.send        # send response to client
          requestId: requestId, clientId: user.id, success: 'y', msgs: messages

# handle /send request
app.post '/send', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId
  messageText = req.body.text
  parentIds = req.body.parentIds

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId: userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    # Check that user is connected
    user = users[userId]
    if not user?
      res.send # user not connected, send failure response
        requestId: requestId, clientId:userId, success: 'n',
        err: 'Bad client ID'
    else
      # Check that user has joined a channel
      channel = user.channel
      if not channel?
        res.send
          requestId: requestId, clientId:userId, success: 'n',
          err: 'Client has not joined a channel'
      else
        # Add the new message to the user's channel
        channel.newMessage user, parentIds, messageText, (err, messageId) ->
          if err?
            res.send
              requestId: requestId, clientId: userId, success: 'n',
              err: 'Error sending message.'
          else
            console.log "Message sent. id: #{messageId} text: #{messageText}"
            res.send
              requestId: requestId, clientId: userId, success: 'y', msgId: messageId

# hande /leave request
app.post '/leave', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId:userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    # Check user connected
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId: userId, success: 'n'
        err: 'Invalid client ID (user not connected)'
    else
      # Check user joined a channel
      channel = user.channel
      if not channel?
        res.send
          requestId: requestId, clientId: userId, success: 'n'
          err: "Client hasn't joined a channel"
      else
        if channel.removeUser user
          res.send # successfully removed user from channel
            requestId: requestId, clientId: userId, success: 'y'
        else
          res.send # failed to remove user from channel
            requestId: requestId, clientId: userId, success: 'n'
            err: 'Error leaving channel'

app.post '/name', (req, res) ->
  throw globals.notImplementedError

# handle /disconnect request
app.post '/disconnect', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId: userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    # Check user is connected
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId: userId, success: 'n'
        err: 'Invalid client ID (user not connected)'
    else
      user.kill()
      res.send # successfully disconnected
        requestId: requestId, clientId: user.id, success: 'y'

# Start the server!
app.listen process.env.PORT || globals.LOCAL_PORT

# Start the REPL to enable interaction from the command line
# TODO document how to use is
repl = require 'repl'
cmd = repl.start({})
cmd.context.channels = channels
cmd.context.users = users






