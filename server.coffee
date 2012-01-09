express = require 'express'
storage = require './storage'
messages = require './messages'
globals = require './globals'
Channel = require './Channel'
User = require './User'


users = {}      # stores all online users. keys are user IDs
channels = {}   # stores all active channels. keys are channel names

addUser = (user) -> users[user.id] = user

removeUser = (user) -> delete users[user.id]

addChannel = (channel) -> channels[channel.id] = channel

userConnected = (username) ->
  for id,user of users
    return true if user.name == username
  return false


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

app.get '/', (req, res) ->
  res.render 'client'
    layout: false


app.post '/connect', (req, res) ->
  res.contentType 'application/json'


  name = req.body.name
  requestId = req.body.requestId
  if not name? or not requestId?
    res.send
      requestId: requestId
      success: 'n'
      err: 'Missing parameter(s)'
  else
    getUser name, (err, user) ->

      if err? then res.send
        success: 'n'
        requestId: requestId
        err: err
      else
        console.log 'got user ' + user.name

        addUser user
        user.on 'disconnect', (e) ->
          console.log "#{e.user.name} disconnected"
          removeUser e.user

        res.send
          success: 'y'
          requestId:requestId
          clientId: user.id


app.get '/channels', (req, res) ->
  throw globals.notImplementedError

app.post '/join', (req, res) ->
  res.contentType 'application/json'

  channelName = req.body.channelName
  requestId = req.body.requestId
  userId = req.body.clientId

  if not channelName? or channelName == '' then channelName = globals.DEFAULT_CHANNEL_NAME

  if not requestId? or not userId?
    res.send
      requestId: requestId
      success: 'n'
      clientId: userId
      err: 'Missing parameter(s)'
  else
    # check user connected
    user = users[userId]
    if not user?
      res.send
        requestId: requestId
        success: 'n'
        clientId: userId
        err: 'Invalid client ID'
    else
      # callback for when channel is loaded
      channelReady = (channel) ->
        channel.addUser user
        res.send
          requestId: requestId
          clientId: userId
          channelName: channel.name
          success: 'y'

      # check channel active
      channel = channels[channelName]
      if not channel?
        # try to load channel, otherwise create it
        console.log "trying to load channel #{channelName}"
        Channel.load channelName, (err, loadedChannel) ->
          if not err? # channel loaded
            console.log "Channel #{channelName} loaded"
            channelReady loadedChannel
          else
            # create it (assuming error means channel doesn't  exist..)
            console.log "creating channel #{channelName}"
            Channel.create channelName, (err, newChannel) ->
              if not err? #channel created
                console.log "Channel #{channelName} created"
                newChannel.on 'close', (channel) -> delete channels[channel.name]
                channelReady newChannel
              else
                res.send
                  requestId: requestId
                  clientId: userId
                  success: 'n'
                  err: 'Unable to join channel, try again'

app.get '/who', (req, res) ->
  throw globals.notImplementedError

app.get '/clients', (req, res) -> # get active users in a channel
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

    # callback for once channel is determined
    getUsers = (channel) ->
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
      getUsers user.channel
    else
      channel = channels[channelName]
      if channel?
        getUsers channel
      else
        res.send
          requestId: requestId, clientId: user.id, success: 'n'
          err: 'Channel not active'

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

    # callback once we know which channel to get messages from
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
      getMessages channel
      if not channel?
        res.send
          requestId: requestId, clientId:clientId, success: 'n',
          err: 'Specified channel does not exist.'
      else
        getMessages channel

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

      user.poll timeoutMs, (err, messages) ->
        console.log "#{user.name} polled"
        if err?
          res.send
            requestId: requestId
            clientId: userId
            success: 'n'
            err: 'Error while polling for new messages: ' + err
        else
          res.send
            requestId: requestId, clientId: user.id, success: 'y', msgs: messages

app.post '/send', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId
  messageText = req.body.text
  #parentIds = req.body['parentIds[]']
  #if not typeof parentIds == 'object' then parentIds = [parentIds]
  parentIds = req.body.parentIds

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId: userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId:userId, success: 'n',
        err: 'Bad client ID'
    else
      channel = user.channel
      if not channel?
        res.send
          requestId: requestId, clientId:userId, success: 'n',
          err: 'No channel found for client'
      else
        channel.newMessage user, parentIds, messageText, (err, messageId) ->
          if err?
            res.send
              requestId: requestId, clientId: userId, success: 'n',
              err: 'Error sending message.'
          else
            console.log "Message sent. id: #{messageId} text: #{messageText}"
            res.send
              requestId: requestId, clientId: userId, success: 'y', msgId: messageId

app.post '/leave', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId:userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId: userId, success: 'n'
        err: 'Bad client ID'
    else
      channel = user.channel
      if not channel?
        res.send
          requestId: requestId, clientId: userId, success: 'n'
          err: 'No channel found for client'
      else
        if channel.removeUser user
          res.send
            requestId: requestId, clientId: userId, success: 'y'
        else
          res.send
            requestId: requestId, clientId: userId, success: 'n'
            err: 'Error leaving channel'

app.post '/name', (req, res) ->
  throw globals.notImplementedError

app.post '/disconnect', (req, res) ->
  res.contentType 'application/json'

  requestId = req.body.requestId
  userId = req.body.clientId

  if not requestId? or not userId?
    res.send
      requestId: requestId, clientId: userId, success: 'n'
      err: 'Missing parameter(s)'
  else
    user = users[userId]
    if not user?
      res.send
        requestId: requestId, clientId: userId, success: 'n'
        err: 'Bad client ID'
    else
      channel = user.channel
      user.kill()
      res.send
        requestId: requestId, clientId: user.id, success: 'y'

app.listen process.env.PORT || globals.LOCAL_PORT

repl = require 'repl'
cmd = repl.start()
cmd.context.channels = channels
cmd.context.users = users






