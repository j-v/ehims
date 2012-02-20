exports.notImplementedError = Error 'Not implemented'

exports.HOST = null # localhost
exports.LOCAL_PORT = 80
exports.USER_TIMEOUT_DELAY = 10000      # (ms) log off client if it hasnt polled f
                                        # for this long
exports.USER_MAX_POLL_TIME = 5000      # (ms) max time a client can poll w/o response
exports.SERVER_POLL_INTERVAL = 50       # (ms) interval to wait to check for new
                                        # enqueued messages on client poll
exports.DEFAULT_CHANNEL_NAME = 'default'

# array copy method
Array::copy = ->
  copy = []
  for n in [0..@length-1]
    if this[n] != undefined then copy[n]=this[n]
  return copy

exports.timestamp = -> (new Date()).getTime()
