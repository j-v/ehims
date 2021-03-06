# Define the models used by Mongoose to store data into the MongoDB database

exports.MESSAGE_TYPE_MESSAGE = 0
exports.MESSAGE_TYPE_JOIN = 1
exports.MESSAGE_TYPE_LEAVE = 2
exports.MESSAGE_TYPE_CHANNEL_CLOSE = 3

timestamp = -> (new Date()).getTime()

# arugment mongoose is a connected mongoose ORM object
exports.initModels = (mongoose) ->
  Schema = mongoose.Schema
  ObjectId = Schema.ObjectId

  Message = new Schema
    type: {type: Number, min:0, max:3},
    text: String,
    userId: ObjectId,
    parentIds: [ObjectId],
    channelId: {type: ObjectId, index: true}
    date: {type: Date, default: Date.now}
    username: String
  exports.Message = mongoose.model 'Message', Message

  User = new Schema
    username: {type: String, required: true, index: {unique: true} },
  exports.User = mongoose.model 'User', User

  Channel = new Schema
    name: {type:String, required: true, index: {unique: true} }
  exports.Channel = mongoose.model 'Channel', Channel
