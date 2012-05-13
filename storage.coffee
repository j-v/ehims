mongoose = require 'mongoose'
models = require './models'
messages = require './messages'
globals = require './globals'
#{ObjectID, Db, Server} = require 'mongodb'
#mongo = require 'mongodb'

LOCAL_DB_URL = 'mongodb://localhost/ehims'


MONGOHQ_USER = MONGOHQ_PASS = 'heroku'


# initialize the database
console.log 'connecting to database'
console.log  process.env.MONGOHQ_URL || LOCAL_DB_URL
mongoose.connect process.env.MONGOHQ_URL || LOCAL_DB_URL
console.log 'connected to database'
models.initModels mongoose

exports.storeMessage = (message, channelId, callback = (err, msgId) -> ) ->
  #TODO validate channel?

  model = undefined
  switch message.type
    when messages.MESSAGE_TYPE_JOIN
      model = new models.Message
        type: models.MESSAGE_TYPE_JOIN,
        channelId: channelId,
        userId: message.clientId
        username: message.clientName
      model.save()
    when messages.MESSAGE_TYPE_LEAVE
      model = new models.Message
        type: models.MESSAGE_TYPE_LEAVE,
        channelId: channelId,
        userId: message.clientId
    when messages.MESSAGE_TYPE_MESSAGE
      model = new models.Message
        type: models.MESSAGE_TYPE_MESSAGE,
        channelId: channelId,
        userId: message.clientId,
        #parentIds: (id for id in message.parentIds),
        parentIds: message.parentIds,
        text: message.text
    when messages.MESSAGE_TYPE_CHANNEL_CLOSE
      model = new models.Message
        type: models.MESSAGE_TYPE_CHANNEL_CLOSE,
        channelId: channelId
    else
      return false # TODO raise exception?

  #TODO : set date based on message.timestamp?
  model.save()
  callback null, model._id


exports.newUser = (params, callback) ->
  # params is object { string name }
  # callback sends user id as result, or error
  user = new models.User {username: params.name}
  user.save (err, res) ->
    if err?
      callback err, null
    else
      id = res._id
      callback null, id

exports.getUserParams = (username, callback) ->
  models.User.findOne {username: username}, (err, res) ->
    if err?
      callback err, null
    else
      if not res?
        callback 'User not found', null
      else
        userParams = {
          name: username,
          id: res._id
          # any new parameters for User constructor will go here
        }
        callback null, userParams


exports.newChannel = (params, callback) ->
  channel = new models.Channel {name: params.name}
  channel.save (err, res) ->
    if err?
      callback err, null
    else
      id = res._id
      callback null, id

exports.getChannelParams = (channelName, callback) ->
  models.Channel.findOne {name: channelName}, (err, res) ->
    if err?
      callback err, null
    else
      if not res?
        callback 'Channel not found', null
      else
        channelParams =
          name: channelName,
          id: res._id
        callback null, channelParams

exports.channelExists = (channelName, callback) ->
  models.Channel.findOne {name: channelName}, (err, res) ->
    if err?
     callback err, null
    else
      foundChannel = if res? then true else false
      callback null, foundChannel


exports.getUserName = (userId, callback) ->
  models.User.findOne {_id: userId}, ['username'], (err, res) ->
    if err then callback err, null
    else
      if not res? then callback 'User not found', null
      else
        username = res.username
        callback null, username

exports.userExists = (username, callback) ->
  models.User.findOne {username: username}, (err, res) ->
    if err?
     callback err, null
    else
      foundUser = if res? then true else false
      callback null, foundUser

exports.getUserParams = (username, callback) ->
  models.User.findOne {username: username}, (err, res) ->
    if err?
      callback err, null
    else
      if not res?
        callback 'User not found', null
      else
        userParams = {
          name: username,
          id: res._id
        }
        callback null, userParams

exports.getChannelName = (channelId) ->
  throw globals.notImplementedError

typeMapping = []
typeMapping[models.MESSAGE_TYPE_MESSAGE] = messages.MESSAGE_TYPE_MESSAGE
typeMapping[models.MESSAGE_TYPE_JOIN] = messages.MESSAGE_TYPE_JOIN
typeMapping[models.MESSAGE_TYPE_LEAVE] = messages.MESSAGE_TYPE_LEAVE
typeMapping[models.MESSAGE_TYPE_CHANNEL_CLOSE] = messages.MESSAGE_TYPE_CHANNEL_CLOSE

exports.getAllMessages = (channelId, callback) ->
  console.log 'getting messages'

  stream = (models.Message.find {channelId: channelId}).stream()

  messageList = []

  stream.on 'data', (doc) ->
    messageList.push
      type: typeMapping[doc.type]
      text: doc.text
      parentIds: doc.parentIds
      timestamp: doc.date.getTime()
      clientId: doc.userId
      clientName: doc.username
      id: doc._id

  stream.on 'close', ->
    callback null, messageList


