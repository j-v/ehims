// IMstorage.js
// jvolkmar 2010

/*
conversation history storage in im app

discussion
{ [client1, ...]
, [msg1, ...]
}

client
{ name
, id
, ?modifiers? -eg color
}

msg
{ id
, clientId
, text
, [parent1, ... ]
, timestamp
, ?flags? -eg urgent
}

IMstorage object:
- constructor:
 takes a filename, creates file if doesn't exist or loads existing file
- close() : finish up writing to files, close all for end of session
- storeMsg(...): store a single message (include join/leave ?)
- storeJoin(..)
- storeLeave(..)
- read() : read the entire message and client history
- getMsgByID(ID) : get a specific message

?- read(from,to) : bypasses messages whose parents are before from
?- getClients() : gets array of all clients involved in message history

*/

var notImplementedError = new Error("Not implemented");

var fs = require('fs')
, sys = require('sys');

var MSG_BUFFER_LENGTH = 100;
STORAGE_PATH = '../storage/';

Array.prototype.copy = function () {
	var ret = [];
	for (n = 0; n < this.length; n++) {
		ret[n] = this[n];	
	}
	return ret;
}

function fileExists(path) {
	try {
		var fstats = fs.statSync(path);
		if (fstats.isFile()) return true; 
	} catch (e) {
		return false;
	}
	return false;
}


exports.ChannelStorage = function (channelName, readyFn) {
	
	if (readyFn == undefined) readyFn = function(readyData) {};
	
	var channelName = channelName;
	var msgBuffer = new Array( MSG_BUFFER_LENGTH );	
	var msgBufferCount = 0;
	var logFile = null;
	var logFileCount = 0;
	var tempFiles = []; //log files in xml format?
	
	// START 'constructor' code
	
	if (channelName == undefined) channelName = 'default';
	if (typeof(channelName) != 'string')
		throw Error('1st parameter "channelName" passed to IMstorage constructor must be a string');
	
	//check if file exists
	var logfileName = channelName + '.json';
	var path = STORAGE_PATH + channelName + '.json';
	sys.puts('looking for '+path);
	var file_exists = fileExists(path);
	
	
	if (!file_exists) {
		sys.puts('creating ' + channelName);
		readyFn({});
		
	} else {
		sys.puts('loading ' + channelName);
		//create a new session
		logFile = logfileName;
		sys.puts(logFile);
		logfileName = null;
		
		//get logFileSize
		var logfileData = '';
		var rs = fs.createReadStream(STORAGE_PATH+logFile, {encoding:'utf8'});
		rs.addListener('data', function (data) {logfileData += data; });
		rs.addListener('end', function () { 
				
			var logMsgs = JSON.parse(logfileData);
			logFileCount = logMsgs.length;
			logMsgs = null;
			sys.puts(logFileCount + ' messages found in log');
			sys.puts('ChannelStorage ready for ' + channelName + 'ready');
			readyData = {msgCount: logFileCount };
			readyFn(readyData);
		});
		sys.puts('reading chat history...');		
	}
	
	
	// END constructor
	
	var store = function (msg) {		
		msgBuffer[msgBufferCount] = msg;		
		msgBufferCount++;
		
		//if buffer full flush it to file in stringified JSON format
		if (msgBufferCount >= MSG_BUFFER_LENGTH) {
			flushMsgBuffer(); 
		}
		sys.puts('message stored');
	}
	
	// TODO delete
	var flushJobs = [];
	
	// TODO delete
	var flushMsgBuffer = function (cb) {
		if (msgBuffer.length == 0) {
			if ( typeof(cb) == 'function' ) cb();			
			return;
		}
		
		//create a job
		var jobname = 'job'+tempFiles.length
		flushJobs.push(jobname);		
		
		//var bufferCopy = msgBuffer.copy(); //copy the array so we don't block incoming messages
		var bufferCopy = msgBuffer;
		msgBuffer = new Array(MSG_BUFFER_LENGTH); //clear msgBuffer
		msgBufferCount = 0;		
		
		
		//create a new file
		tempFilename = channelName + tempFiles.length + '.json';
		tempFiles.push(tempFilename);
		path = STORAGE_PATH + 'temp/' + tempFilename;
		ws = fs.createWriteStream(path, {'encoding':'utf8'}); // 2nd arg necc?	
		ws.addListener('close', function () { 
			//remove job
			flushJobs.splice(flushJobs.indexOf(jobname),1);
			//callback
			if ( typeof(cb) == 'function' ) cb(); 
		});
		
		//write json to file
		var data = JSON.stringify(bufferCopy);
		bufferCopy = null;
		sys.puts('writing to ' + tempFilename + ': ' + data);
		ws.write(data, 'utf8');
		ws.end();
		

	}
	
	// TODO change
	this.storeMsg = function (clientId, text, msgId, parentIds, timestamp) //flags argument?
	{
		//validate message.. for now assume fine
		
		//store msg in msgBuffer
		msg = { 
			type: 'msg',
			clientId: clientId,
			text: text,
			id: msgId,
			parentIds: parentIds,
			timestamp: timestamp 
		}
		
		store(msg);
	}
	
	// TODO change
	this.storeJoin = function (clientId, clientName, timestamp)
	{
		msg = { 
			type: 'join',
			clientId: clientId,
			clientName: clientName,
			timestamp: timestamp 
		}			
		
		store(msg);
	}
	
	// TODO change
	this.storeLeave = function (clientId, timestamp) {
		msg = { 
			type: 'leave',
			clientId: clientId,
			timestamp: timestamp 
		}
		
		store(msg);
	}
	
	
	// TODO change. close db connection, perhaps
	this.close = function (cb) {
		//get entire message history, write it into one file
		
		
		this.readHistory( function (msgs) {
			//delete all temp log files
			var tempPath = STORAGE_PATH+'temp/';
			for (var n=0; n<tempFiles.length; n++) {
				fs.unlinkSync(tempPath + tempFiles[n]);
			}			
			//dump history
			var ws = fs.createWriteStream(STORAGE_PATH+channelName+'.json', {encoding:'utf8'});
			if (typeof(cb)=='function') ws.addListener('close', cb)
			ws.write(JSON.stringify(msgs),'utf8');
			ws.end();
		});
		
	}	
	
	// TODO Change, maybe delete
	this.readHistory = function (cb) {
		// callback is cb(msgData), array of all messages
		if (typeof(cb) == 'undefined') throw Error('you must provide a callback for IMstorage.readHistory()');
		
		
		var FLUSH_WAIT_INTERVAL = 10; //ms
		
		//wont start til all flush jobs are finished (see waitfun below)
		var readyfun = function() {
		
			//read the entire client and message history
			//used when a new client joins
			
			
			msgDataSize = logFileCount + MSG_BUFFER_LENGTH * (tempFiles.length) + msgBufferCount;
			
			msgData = new Array(msgDataSize); //should estimate size needed, based on # tempfiles etc..
			msgDataPos = 0;
			
			var addMsgs = function (msgs) {
				for (var n=0; n<msgs.length; n++) {
					var msg = msgs[n];
					if (msg == undefined) continue;
					if (msg.type == undefined) continue; //ignore non-message data
					msgData[msgDataPos] = msg;
					msgDataPos++;
				}
			}		
			
			var readTempFiles = function () {
				
				//2. tempfiles				
				var readTempFile = function ( filename, cb ) {
					var fileData = '';
					var tfrs = fs.createReadStream(STORAGE_PATH+'temp/'+filename, {'encoding': 'utf8'});					
					tfrs.addListener('data', function (data) {fileData += data; });
					tfrs.addListener('end', function () {
						var msgs = JSON.parse(fileData);
						addMsgs(msgs);
						
						cb(msgData);			
						
					});
					
				}
				
				//create chain to read all tempfiles (using readTempFile)
				
				//var readThen = function(filename, readcb) {readTempFile(filename); readcb(); };
				readFun = function (n) {
					var readcb = ( n < (tempFiles.length - 1)) ? 
						function() { readFun(n+1); } 
						: function () { 
							sys.puts('adding buffered messages...');
							addMsgs(msgBuffer); cb(msgData); 
							msgData = null;
						} ; //END OF FUNCTION					
					readTempFile(tempFiles[n], readcb );
				}
				if (tempFiles.length > 0) {				
					sys.puts('reading temp log files...');
					readFun(0); //here it goes...
				}
				else
				{
					sys.puts('adding buffered messages...');
					addMsgs(msgBuffer);
					cb(msgData);
					msgData = null;
					
				}
			}
			
			//1. logFile
			if (logFile != null) {				
				var logFileData = '';
				sys.puts('reading log file...');
				var rs = fs.createReadStream(STORAGE_PATH+logFile, {'encoding': 'utf8'});				
				rs.addListener('data', function (data) { logFileData += data; });
				rs.addListener('end', function () {
					logMsgs = JSON.parse(logFileData);
					addMsgs(logMsgs);
	
					readTempFiles();
					
					
				});
			} else {
				readTempFiles();
			}
		}
		
		var waitfun = function () {
			if (flushJobs.length > 0) {
				sys.puts('waiting for flush jobs to finish');
				setTimeout(waitfun,FLUSH_WAIT_INTERVAL);
			}
			else readyfun();
		}
		
		waitfun();
		
	}
	
	// TODO
	this.getMsgByID = function(ID) {
		throw notImplementedError;
	}
	
}
