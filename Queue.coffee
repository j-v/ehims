globals = require './globals'
{EventEmitter} = require 'events'

class Queue extends EventEmitter
  _arr: []
  empty: true
  enqueue: (item) ->
    @_arr.push item
    @empty = false
    @emit 'new', {queue: this}
  dequeue: ->
    if @_arr.length ==1 then @empty = true
    @_arr.shift()
  front: -> @_arr[0]
  clear: -> throw globals.notImplementedError
  all: ->
    ret = @_arr
    @_arr = []
    @empty = true
    ret
module.exports = Queue
