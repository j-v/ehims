mongoose = require 'mongoose'
models = require './models'
messages = require './messages'
globals = require './globals'


LOCAL_DB_URL = 'mongodb://localhost/ehims'

# initialize the database
mongoose.connect process.env.MONGOHQ_URL || LOCAL_DB_URL
models.initModels mongoose

exports.storeMessage = (message, channelId) ->
  #TODO validate channel?

  model = undefined
  switch message.type
    when messages.MESSAGE_TYPE_JOIN
      model = new models.Message({
        type: models.MESSAGE_TYPE_JOIN,
        channelId: channelId,
        userId: message.userId
      })
      model.save()
    when messages.MESSAGE_TYPE_LEAVE
      model = new models.Message({
        type: models.MESSAGE_TYPE_LEAVE,
        channelId: channelId,
        userId: message.userId,

      })
    when messages.MESSAGE_TYPE_MESSAGE
      model = new models.Message({
        type: models.MESSAGE_TYPE_MESSAGE,
        channelId: channelId,
        userId: message.userId,
        parentIds: messages.parentIds,
        text: message.text
      })
    when messages.MESSAGE_TYPE_CHANNEL_CLOSE
      model = new models.Message({
        type: models.MESSAGE_TYPE_CHANNEL_CLOSE,
        channelId: channelId
      })
    else
      return false # TODO raise exception?

  #TODO : set date based on message.timestamp?
  model.save()

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
        channelParams = {
          name: channelName,
          id: res._id
        }
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
  models.User.findOne {name: username}, (err, res) ->
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

exports.getAllMessages = (channelId, callback) ->

  models.Messages.find {channelId: channelId}, (err, res) ->
    if err?
      callback err, null
    else
      messageList = ({
          type: messages.MESSAGE_TYPE_MESSAGE
        , text: message.text
        , parentIds: message.parentIds # does this work?
        , timestamp: message.date.getTime()
        , clientId: message.userId
      } for message in res)
      callback null, messageList

