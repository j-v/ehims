// IMServer.js
// j volkmar 2010

/*
	-Msg
		ID
		clientID
		text
		parents = [ Msg1, ... ]
		timestamp
	-Client
		getInfo -> ClientInfo
		name : *string
		ID : *string
		msgQueue : *queue
		channel
*/

var notImplementedError = Error('not implemented');

HOST = null; // localhost
PORT = 8001;
DEFAULT_CHANNEL_NAME = 'default';
CLIENT_TIMEOUT_DELAY = 60 * 1000; // (sec) : time to allow client to stay signed on and not poll w/o automatically logging him off
CLIENT_MAX_POLL_TIME = 30 * 1000; // (sec) : max time a client can poll before responding with blank response
SERVER_POLL_INTERVAL = 50; // (ms) : interval to wait to check for new enqueued messages when client is polling




var fu = require("./fu"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring"),
    fs = require('fs'),
    IMStorage = require("./IMStorage");

// when the daemon started
var starttime = (new Date()).getTime();

// TODO
var clientHistory = new Array;
// TODO
var clientIdFactory = new function () {
	var nextId = 1;
	this.getId = function (client) {
		return nextId++;
	}
	this.setLastId = function(id) {
		nextId = id +1;
	}
}

// TODO shouldn't need this
function fileExists(path) {
	try {
		var fstats = fs.statSync(path);
		if (fstats.isFile()) return true;
                else return false;
	} catch (e) {
		return false;
	}
	return false;
}

//read init.json, set clientHistory, set last Client ID
var initData = '';

// TODO need another init system
if (fileExists('../init.json')) {

	sys.puts('Reading init.json...');
	var rs = fs.createReadStream('../init.json' , {encoding:'utf8'});
	rs.addListener('data', function (data) {initData += data;});
	rs.addListener('end', function () {

		var initObj = JSON.parse(initData || '{}');
		clientHistory = initObj.clientHistory || [];

		var numClients = clientHistory.length;
		clientIdFactory.setLastId(numClients);
		sys.puts(numClients + ' clients in history');
		sys.puts('Done reading init.json');
	});
} else {
	sys.puts('Warning: init.json not found! Client history not retrieved');
}

var Queue = function() {
	var _array = [];
	this.empty = true;
	this.enqueue = function(item) {
		_array.push(item);
		this.empty = false;
	}

	this.dequeue = function() {
		if (_array.length == 1) this.empty = true;
		return _array.shift();
	}

	this.front = function () {
		return _array[0];
	}
	this.clear = function () {
		throw notImplementedError;
	}

}


function timestamp() {
	return (new Date).getTime();
}


var clients = {}; //object, members are client ids
var channels = {}; //members are channel names

// TODO NO
var channelIdFactory = new function () {
	//channel ids may not be necessary
	var nextId = 0;
	this.getId = function (channel) {
		return nextId++;
	}
	this.setLastId = function(id) {
		nextId = id+1;
	}
}
var channelTemplate = function(name) {
	if (name == undefined) throw Error("must provide name for channelTemplate");
	var _ready = false;
	// TODO NO FACTORIES
	var msgIdFactory = new function() {
		var nextId = 1;
		this.getId = function (msg) {
			return nextId++;
		}
		this.setLastId = function(id) {
			if (id == undefined) return;
			nextId = Number( id) + 1;
		}
	}
	var joinedClients = [];
	var _closing = false;
	this.closing = function () {return _closing;} //when joining, clients will check for this property

	this.ready = function() {return _ready};

	this.onReady = function(cb, timeoutsec, timeoutfn) {
		//set a function to execute when channel is ready
		//optionally provide timeout in seconds and function to execute on timeout
		if (_ready) {cb()}

		cancel = false;
		if (timeoutsec != undefined) {
			setTimeout(function() {cancel = true;}, timeoutsec * 1000);
		}

		var loopfn = function () {
			if (cancel) {
				timeoutfn();
				return;
			}
			if (_ready) cb();
			else setTimeout(loopfn, 50);
		}
		loopfn();
	}

	this.name = name;
	this.storage = new IMStorage.ChannelStorage(name, function(readyData) {
		//msgIdFactory.setLastId(readyData.msgCount);
		_ready = true;
	} );
	/*
	this.getInfo = function() {
		return {
			name: this.name
		}
	};
	*/

	this.broadcast = function(msg) {
		//validate message?
                validMsgTypes = ['msg','join','leave','system'];
		if (validMsgTypes.indexOf(msg.type) == -1) throw Error('unsupported message type');

		//TODO don't get id. instead, put in storage and get retrieved ID
		//msg.id = msgIdFactory.getId(msg);

		//add to all client's msgQueues (except sender)
		for (var i =0; i< joinedClients.length; i++) {
			var client = joinedClients[i];
			if (client.id == msg.clientId) {continue;}

                        sys.puts('broadcast++');

			client.msgQueue.enqueue(msg);
		}

		var sender = clients[msg.clientId];

		//save in storage TODO KILL
		switch (msg.type) {
			case 'msg' :
				this.storage.storeMsg(msg.clientId, msg.text, msg.id, msg.parentIds, msg.timestamp);
				sys.puts(sender.name + " : " + msg.text);
				break;
			case 'join' :
				this.storage.storeJoin(msg.clientId, msg.clientName, msg.timestamp);
				sys.puts(sender.name + ' joined ' + sender.channel.name);
				break;
			case 'leave' :
				this.storage.storeLeave(msg.clientId, msg.timestamp);
				sys.puts(sender.name + 'left ' + sender.channel.name);
				break;
			case 'system' :
				break;
		}
	};
	this.addClient = function(client) {


		if (joinedClients.indexOf(client) == -1) {
			joinedClients.push(client);
			sys.puts(joinedClients.length + ' clients in channel');
			client.channel = this;
			var msg = {type:'join'
				, clientId: client.id
				, clientName: client.name
				, timestamp: timestamp()}
			this.broadcast(msg);
			return true;
		} else {
			//client already joined
			return false;
		}
	};
	this.removeClient = function (client) {
		var clientIndex = joinedClients.indexOf(client);
		if (clientIndex == -1)
			//throw Error("tried to remove client who is not in room"); //client not found
			return false;
		else {


			var msg = {type: 'leave'
				  , clientId: client.id
				  , timestamp: timestamp()};

			this.broadcast( msg );
			if (joinedClients.length == 1) { //last client.. close shop
				this.close();

			}
			client.channel = null; //might change this if allow clients to be in multiple channels
			joinedClients.splice(clientIndex, 1);
			return true;
		}

	}

	this.close = function(cb) {
		sys.puts('closing channel ' + this.name + '...');
		if (cb == undefined) cb = function() {};
		_closing = true;
		//advise all clients channel closed (this will stop all pending poll requests as well)
		closeMsg = {
			type: 'system',
			channelName: this.name,
			action: 'close',
			timestamp: timestamp()
		}
		this.broadcast(closeMsg);
		for (var i =0; i++; i<joinedClients.length)
			joinedClients[i].channel=null;

		//close storage
		var channelName = this.name;
		this.storage.close( function () {
			delete channels[channelName];

			cb();
			sys.puts('channel closed');
		});
	}
	this.clients = function() {
		var ret = Array(joinedClients.length);
		for (var i=0; i<ret.length; i++) {
			ret[i]=clientInfo(joinedClients[i]);
		}
		return ret;
	}
}

var createChannel = function(name) {
	if (name === undefined) name = DEFAULT_CHANNEL_NAME;
	else {
		//validate channel name
	}

	for (var i in channels) {
		var channel = channels[i];
		if (channel && i == name) return null; //channel already in use
	}

	// TODO CHECK DB instead
	//check if file in ../channels/ already exists
	if (fileExists('../storage/'+name+'.json')) {
		return null;
	}

	var channel = new channelTemplate(name);
	//channel.id = channelIdFactory.getId(channel);

	channels[name] = channel;

	sys.puts('created channel '+name);

	return channel;
	//should wait til channel is ready?
}

var loadChannel = function(name) {
	if (name === undefined) name = DEFAULT_CHANNEL_NAME;

	// TODO check db
	for (var i in channels) {
		var channel = channels[i];
		if (channel && i == name) return null; //channel already in use
	}
	if (!fileExists('../storage/'+name+'.json')) {
		return null;
	}

	var channel = new channelTemplate(name);
	//channel.id = channelIdFactory.getId(channel);

	channels[name] = channel;

	sys.puts('loaded channel '+name);

	return channel;
}




//client will need to poll as soon as he is connected, event before joining
var clientTimeoutFn = function(clientId) {
	var client = clients[clientId];
	sys.puts(client.name + ' timed out');
	client.kill();
}

var clientTemplate = function() {
	var name = null;
	var channel = null;
	this.id = null;
	this.msgQueue = new Queue;
	this.kill = function () {
		//if client is polling?
		clearTimeout(this.timeout);
		if (this.channel) {
			this.channel.removeClient(this);
		}
		delete this.msgQueue;
		delete clients[this.id];
	}
	this.timeout = null;
	this.resetTimeout = function () {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(clientTimeoutFn, CLIENT_TIMEOUT_DELAY, [this.id]);
	}
}

var validateClientName = function(name) {
	return true;
}

var createClient = function(name) {
	//validate name
	if (!validateClientName(name)) {
		return null;
	}

	//check name doesn't already exist
	for (var i in clients) {
		var client = clients[i];
		if (client && client.name == name) return null;
	}

	var client = new clientTemplate;
	client.name = name;
	// TODO no id factories!!
	var id = clientIdFactory.getId(client);
	client.id = id;
	client.timeout = setTimeout(clientTimeoutFn, CLIENT_TIMEOUT_DELAY, [client.id])

	clients[id] = client;

	//add to clientHistory TODO what is client history for?
	clientHistory.push(clientInfo(client));

	sys.puts('New client "'+name+'" connected');

	return client;
}
var loadClient =  function(name) {
	//validate name
	if (!validateClientName(name)) {
		return null;
	}

	//check client doesn't already exist
	for (var i in clients) {
		var client = clients[i];
		if (client && client.name == name) return null;
	}

	//get data from clientHistory
	var clientInfo;
	for (var i = 0; i<clientHistory.length; i++) {
		var oldclient = clientHistory[i];
		if (oldclient.name == name) {
			//found client info
			clientInfo = oldclient;
			break;
		}
	}

	if (clientInfo == null) return null; //client not found

	var client = new clientTemplate;
	client.name = clientInfo.name;
	var id = clientInfo.id;
	client.id = id;
	client.timeout = setTimeout(clientTimeoutFn, CLIENT_TIMEOUT_DELAY, [id])

	clients[id] = client;

	sys.puts('Returning client "'+name+'" connected');

	return client;
}


var close = function() {
	var channelsCloseCont = function () {
		//done closing channels
		//save init.json
		var path = '../init.json';
		var ws = fs.createWriteStream(path, {'encoding':'utf8'}); // 2nd arg necc?
		ws.addListener('close', function () {
			sys.puts('Wrote init.json. Bye!');
			process.exit();
			//DONE!
		});
		//write json to file
		initObj = {clientHistory: clientHistory};
		var data = JSON.stringify(initObj);
		sys.puts('Writing init.json...');
		ws.write(data, 'utf8');
		ws.end();
	}

	var channelNames = [];
	for (var i in channels) channelNames.push(i);

	var channelIndex = 0;

	function closeNextChannel () {
		if (channelIndex < channelNames.length) {
			channels[channelNames[channelIndex]].close(function () {
					channelIndex++;
					closeNextChannel();
			});

		} else {
			channelsCloseCont();
		}
	}
	closeNextChannel();
}

function clientInfo(client) {
	return {id: client.id, name: client.name};
}

fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("../client.html"));
fu.get("/treetest", fu.staticHandler("../treetest.html"));
fu.get("/jquery.js", fu.staticHandler("jquery-1.4.2.min.js"));
fu.get("/funChain.js", fu.staticHandler("funChain.js"));
fu.get("/treeView.js", fu.compoundStaticHandler(
	['./treeView/common.js',
	 './treeView/node.js',
	 './treeView/nodeViewControl.js',
	 './treeView/nodeView.js',
	 './treeView/treeSettings.js',
	 './treeView/tree.js',
	 './treeView/treeViewSettingsEvents.js',
	 './treeView/treeViewSettings.js',
	 './treeView/treeView.js'],
	 '.js'

));
fu.get("/treeView.css", fu.compoundStaticHandler(
	['./treeView/css/treeView.css',
	 './treeView/css/treeViewMsgDisplay.css',
	 './treeView/css/treeViewControls.css'],
	 '.css'

));
fu.get("/IMClient.js", fu.staticHandler("IMClient.js"));
fu.get("/IMClient.css", fu.staticHandler("../css/IMClient.css"));
//add images
fu.get("/icons/minimize.gif", fu.staticHandler("../icons/minimize.gif"));
fu.get("/icons/maximize.gif", fu.staticHandler("../icons/maximize.gif"));
fu.get("/icons/multi.gif", fu.staticHandler("../icons/multi.gif"));

fu.post("/connect", function (query, res) {
	//q: username
	//res: success, clientId or err

	var name = query.name,
	    requestId = query.requestId;

	if (name === undefined || requestId === undefined) {
		//bad request
		res.simpleJSON(200, {requestId: requestId, success: 'n', err: 'Missing parameters'});
		return;
	} else {
		var newClient;
		if (!(newClient = loadClient(name)))
			newClient = createClient(name);

		if (newClient == null) {
			res.simpleJSON(200, {requestId: requestId,
						success: 'n',
						err: 'Name already taken'});
			return;
		} else {
			res.simpleJSON(200, {requestId: requestId,
						success: 'y',
						clientId: newClient.id});
		}
	}
});
fu.get("/channels", function (query, res) {
	throw notImplementedError;
});
fu.post("/join", function (query, res) {
	var channelName = query.channelName,
		requestId = query.requestId,
		clientId = query.clientId;

	if (channelName === undefined || channelName == '') channelName = DEFAULT_CHANNEL_NAME;

	if (requestId === undefined || clientId === undefined) {
		res.simpleJSON(200, {requestId: requestId,
				        clientId: clientId,
					success: 'n',
					err: 'Missing parameter(s)'});
		return;
	}

	var client = clients[clientId];
	if (client == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Invalid client ID'
		});
		return;
	}

	//check if channel active
	var channel = channels[channelName];
	//sys.puts(channel);
	if (channel == undefined || channel == null) {
		//if not, try to load channel
		if (!(channel = loadChannel(channelName))) {
			//if doesn't exist, create channel
			if (!(channel = createChannel(channelName))) {
				res.simpleJSON(200, {
						requestId: requestId,
						clientId: clientId,
						success: 'n',
						err: 'Error creating channel'
				});
				return;
			}
		}
	} else {
		//make sure channel isn't closing
		//if it is, wait til its closed and re-open it
		sys.puts( channelName + ' ready');
	}

	channel.onReady( function () {
			channel.addClient(client);

			//send confirmation
			res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				channelName: channel.name,
				success: 'y'
			});
	},
	5, function() {
			res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Unable to join channel, try again'
			});
		return;
	});



});
fu.get("/who", function (query, res) { //gets info on a specific client, based on id
	throw notImplementedError;
});
fu.get("/clients", function (query, res) { //gets active clients in a channel
	var requestId = query.requestId,
		clientId = query.clientId,
		channelName = query.channelName; //optional

	if (requestId === undefined || clientId === undefined) {
		res.simpleJSON(200, {requestId: requestId, clientId: clientId,
					success: 'n', err: 'Missing parameter(s)'});
		return;
	} else {
		var client = clients[clientId];
		var channel;
		if (channelName === undefined) {
			//use client's active channel
			if (client.channel == null) {
				res.simpleJSON(200, {
					requestId: requestId,
					clientId: clientId,
					success: 'n',
					err: 'No channel specified and client is not in a channel'});
				return;
			}
			else
			{
				channel = client.channel;
			}
		}
		else
		{
			channel = channels[channelName];
			//dbl check channel exists
			if (channel == undefined) {
				res.simpleJSON(200, {
					requestId: requestId,
					clientId: clientId,
					success: 'n',
					err: 'Specified channel does not exist'});
				return;
			}
		}
		//get all clients from channel
		var chanClients = channel.clients();
		res.simpleJSON(200, {requestId: requestId,
					clientId: clientId,
					success: 'y',
					clients: chanClients});
		return;
	}
});
fu.get("/history", function (query, res) {
	var requestId = query.requestId,
		clientId = query.clientId,
		channelName = query.channelName; //optional

	if (requestId == undefined || clientId == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Missing parameter(s)'
		});
		return;
	} else {
		var client = clients[clientId];
		var channel;
		if (channelName === undefined) {
			//use client's active channel
			if (client.channel == null) {
				res.simpleJSON(200, {
					requestId: requestId,
					clientId: clientId,
					success: 'n',
					err: 'No channel specified and client is not in a channel'});
				return;
			}
			else
			{
				channel = client.channel;
			}
		}
		else
		{
			channel = channels[channelName];
			//dbl check channel exists
			if (channel == undefined) {
				res.simpleJSON(200, {
					requestId: requestId,
					clientId: clientId,
					success: 'n',
					err: 'Specified channel does not exist'});
				return;
			}
		}
		//get all messages from channel
		channel.storage.readHistory( function(msgs) {
			res.simpleJSON(200, {
				requestId:requestId,
				clientId: clientId,
				success: 'y',
				msgs: msgs
			});
			return;
		});
	}
});
fu.get("/poll", function (query, res) {
	var requestId = query.requestId,
	    clientId = query.clientId;


	if (requestId == undefined || clientId == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Missing parameter(s)'
		});
		return;
	}

	var client = clients[clientId];
	if (client == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Invalid client ID'
		});
		return;
	}
	//reset client timeout
	client.resetTimeout();

	var pollTimer;
	var timeoutsec = Number(query.timeout);

	if (timeoutsec != undefined && typeof(timeoutsec) == 'number' && timeoutsec < (CLIENT_MAX_POLL_TIME / 1000))
		var timeoutms = timeoutsec * 1000;
	else
		timeoutms = CLIENT_MAX_POLL_TIME;

	var msgs = [];
	var sendPollResponse = function () {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'y',
				msgs: msgs
		});
                return;
	}

	var pollTimeout = setTimeout( function() {
			clearTimeout(pollTimer);
			sendPollResponse();
	}, timeoutms);

	var pollLoop = function () {

		if (clients[client.id] == undefined) {
			//for if client disconnects (will it work right?)
                        sys.puts('aborted poll response: client disconnected');
			clearTimeout(pollTimeout);
			return;
		}

		var queue = client.msgQueue;
		if (!queue.empty) {
			clearTimeout(pollTimeout);
			while (!queue.empty) {
				var msg = queue.dequeue();
				msgs.push(msg);
			}
			sendPollResponse();
		} else {
			pollTimer = setTimeout(pollLoop, SERVER_POLL_INTERVAL);
		}

	}
	pollLoop();
});
fu.post("/send", function(query,res) {
        sys.puts(JSON.stringify(query));
	var requestId = query.requestId,
	    clientId = query.clientId,
	    text = query.text,
	    //parentIds = query.parentIds;
	    parentIds = query['parentIds[]'];

	if (requestId == undefined || clientId == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Missing parameter(s)'
		});
		return;
	}

	var client = clients[clientId];
	if (client == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Bad client ID'
		});
		return;
	}

	var channel = client.channel;
	if (channel == undefined || channel == null) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Client has not joined a channel or channel is no longer valid'
		});
		return;
	}

	if (typeof parentIds != 'object')
	   parentIds = [parentIds];

	var msg = {type: 'msg'
		  , clientId: clientId
		  , parentIds : parentIds
		  , text : text
		  , timestamp : timestamp()} ;

	channel.broadcast(msg);

	//tmp
	if (msg.id == undefined) throw Error("msg has no id");

	//send confirmation
	res.simpleJSON(200, {
			requestId: requestId,
			clientId: clientId,
			success: 'y',
			msgId: msg.id
	});

});
fu.post("/leave", function (query, res) {
	var requestId = query.requestId,
	    clientId = query.clientId;

	if (requestId == undefined || clientId == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Missing parameter(s)'
		});
		return;
	}

	var client = clients[clientId];
	if (client == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Bad client ID'
		});
		return;
	}

	var channel = client.channel;
	if (channel == undefined || channel == null) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Client has not joined a channel or channel is no longer valid'
		});
		return;
	}

	var result = channel.removeClient(client);
	if (!result) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Client not found in specified channel'
		});
	} else {
		//confirmation
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'y'
		});
	}


});
fu.post("/name", function (query, res) {
	throw notImplementedError;
});
fu.post("/disconnect", function (query, res) {
	var requestId = query.requestId,
	    clientId = query.clientId;

	if (requestId == undefined || clientId == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Missing parameter(s)'
		});
		return;
	}

	var client = clients[clientId];
	if (client == undefined) {
		res.simpleJSON(200, {
				requestId: requestId,
				clientId: clientId,
				success: 'n',
				err: 'Bad client ID'
		});
		return;
	}

	//check if client is in a channel
	var channel = client.channel;
	if (channel != null) {
		if (channels[channel.name] != undefined) {
			channel.removeClient(client);
		}
	}

	//remove from clients
	delete clients[clientId];
	clearTimeout(client.timeout);
	sys.puts(client.name + ' disconnected');

	//confirmation
	res.simpleJSON(200 , {
			requestId: requestId,
			clientId: clientId,
			success: 'y'
	});
});


var repl = require('repl');
var cmd = repl.start();
cmd.context.close = close;
