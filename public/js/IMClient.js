//IMClient.js
// j volkmar 2010

var notImplementedError = Error('not implemented');

var POLL_DELAY = 50; //(ms)

var DEQUEUE_BLINK_COLOR = "#DDF"; // TODO describe this

DRAW_FOCUS_CHILDREN = true; // Render a node's children in Message Display when the node is selected
DRAW_FOCUS_SIBLINGS = true; // Render a node's siblings in Message Display when the node is selected
MESSAGE_ID_TYPE = String;   // Data type of message ID

var defaultIMClientParams = {};

function enterKey(event) { //returns true if enter is pressed
	if (event.keyCode == 13) return true;
        else return false;
}

// IMClient -- main application class. Is instantiated at initialization
var IMClient = function (mainElement) {
	if (mainElement == null) throw Error("Must specify a jquery object as mainElement (1st arg in IMClient constructor)");

	// member variable initialization
    var poll_request = null; // TODO document this
	var pollTimer = null; // TODO document this
	var me = null; // Users's client ID
	var channel = null; //set to {name, clients ...} when user joins a channel

	// set DOM elements
	mainElement.addClass('im_main');
	var connectView = mainElement.find('#connect_view');
	var joinView =  mainElement.find('#join_view');
	var channelView = mainElement.find('#channel_view'); //we're assuming only one channel view
	channelView.mainView = channelView.find('#channel_view_main');
	channelView.statusBarView = channelView.find('#status_bar');
	channelView.msgBrowserView = channelView.find('#msg_browser');
	channelView.msgComposerView = channelView.find('#msg_composer');
	channelView.msgDisplayView = channelView.find('#msg_display');
	channelView.sideBarView = channelView.find('#sidebar');
	channelView.msgQueueView = channelView.find('#msg_queue_view');
	channelView.multiParentDisplay = channelView.find('#multiparent_display');
	channelView.msggrippy = channelView.find('#msg_view_grippy');
	channelView.sidegrippy = channelView.find('#sidebar_grippy');
	var loadingMsg = mainElement.find('#loading_msg');
	hideMsgComposer();
	channelView.clientsDisplayView = channelView.find('#clients_display');

	// ------ BEGIN: PUBLIC METHODS ------
	this.connect = function () {
		// User requests to connect to chat server
		var username = connectView.find('#connect_username').val();
		if (username == '') return;

		var query = {requestId: requestIdFactory.getId()
				 , name: username};
		 $.post('/connect', query, function(data) {
		 		 if (data.success == 'y') {
		 		 	 me = {name : username, id : data.clientId};

		 		 	 // Show "join" screen
		 		 	 connectView.fadeOut( function() {
		 		 	 	joinView.fadeIn();
		 		 	 	joinView.find('#join_channel').focus();
		 		 	 });
		 		 } else {
		 		 	alert(data.err);
		 		 }
		 }, 'json');
	}

	this.join = function () {
        var self = this;
		var channelname = joinView.find('#join_channel').val();
		// make query to send to server
		query = {clientId: me.id,
			requestId: requestIdFactory.getId(),
			channelName: channelname};
		//hide the join prompt window
		joinView.fadeOut( function () {

			loadingMsg.show();

			// Send request to server
			$.post('/join', query, function(data) {

				if (data.success == 'y') { 	// request was successfully handled
					
					pollStop();
					// Initialize the channel object
					channel = {
						   name: data.channelName,
						   clients : {},
						   offline : {}, //clients who have participated but who are not currently in the channel
						   tree : new tree(msgTreeSettings),
						   selection : [],
						   getClientById: 
							function(id) {
								var client = this.clients[id];
								if (client != undefined) return client;
								client = this.offline[id];
								if (client != undefined) return client;
								return null;
							}
						};

					// Create the message queue
					msgQueueView = channelView.msgQueueView;
					selectMessageInQueueCallback = function(node) { 
						// show a message in the main view when it is selected in the queue
						selectMessageNode(node); 
					}
					channel.msgQueue = new MessageQueue( 
							msgQueueView, 
							channel,
							selectMessageInQueueCallback); 

					// Create tree views for message browser and message display
					channelView.msgBrowserView.treeView =
						new treeView(channel.tree, channelView.msgBrowserView, msgBrowserTvSettings );
					channelView.msgDisplayView.treeView =
							new treeView(channel.tree, channelView.msgDisplayView, msgDispTvSettings );

					// Initialize status bar
					channelView.statusBarView.children('#status_info').html(
							'name: <span style="color:white">' + me.name + '</span> channel: <span style="color:white">' + channel.name + '</span>');

					// load entire message history of the channel (inclued join, leave, and close messages)
					getHistory(function (msgs) {
						if (msgs==null) {} //some error
						else {
							$('#debug').append('<p>reading history</p>');
							var myLastMsgIndex = 0;
							
							// The following code does two passes through the messages
							// 1. First: find which msg user had last seen (to know which to mark as read)
							// We define last seen as the last message that came in while the user was joined
							// to the channel
							for (var i =0; i< msgs.length; i++) {
								var msg = msgs[i];
								if (msg.type == 'leave' && msg.clientId==me.id) {
									myLastMsgIndex = i;
								}
							}
							
							// 2. Now, build the message tree
							// 2a. Add all message up til last seen are added to tree but not the queue
							for (var i =0; i< myLastMsgIndex; i++) {
								var msg = msgs[i];
								//$('#debug').append('<p>retrieved msg: '+JSON.stringify(msgs[i])+'</p>');
								if (msg.type == 'msg') {
									messageInsertNode(msg, true ); //not readMessage, which makes it blink
								} else {
									readMessage(msgs[i]);

								}
							}

							// 2b. Enable the queue so ew messages will start being put in the MessageQueue
							channel.msgQueue.enable(); 
							for (; i< msgs.length; i++) {
								var msg = msgs[i];
								//$('#debug').append('<p>retrieved msg: '+JSON.stringify(msgs[i])+'</p>');
								if (msg.type == 'msg') {
									messageInsertNode(msg, false ); //not readMessage, which makes it blink
								} else {
									readMessage(msgs[i]);

								}
							}
							// Done reading message history

							$('#debug').append('<p>finished reading history</p>');
						}
						
						// Due to the logic of readMessage(), clients were added as online during
						// reading the message history. We need to mark them as offline, and
						// clear the online clients list
						for (c in channel.clients)
							channel.offline[c] = channel.clients[c]
						channel.clients = {}; 

						// Now, request server for online clients
						getClients(function (clients) {
							if (clients == null) {
								// TODO NEED TO HANDLE THIS PROPERLY
								// THIS CAN CAUSE LOGIN SCREEN TO FREEZE
							} 
							else {
								var chanClients = channel.clients;
								for (var i = 0; i<clients.length; i++) {
									var client = clients[i];
									if (client.id == me.id) continue;
									chanClients[client.id] = client;
								}
								channelView.clientsDisplayView.refresh();
							}
						
							// Loading channel has finished, we can start polling
							// and show the main interface!
							loadingMsg.hide( function() {
								pollStart();
								channel.msgQueue.enable();

								channelView.fadeIn(function() {
									showMsgComposer();
									resizeChannelView();
								});
								self.selectRoot();
								//DONE
							 });
						});


					});


				} else {
					alert(data.err);
				}
			}, 'json');
		});

	}
	
	this.nextMessage = function() {
		// Go to next unread message in the MessageQueue
		if (channel == null) return;

		var nextMsgNode = channel.msgQueue.next();
		if (nextMsgNode != null) {
			selectMessageNode(nextMsgNode);

		}
	}

	this.prevMessage = function() {
		// This is currently unused due to difficulties in maintaining order of messages within
		// current behavior
		
		if (channel == null) return;
		var currNode = channel.msgQueue.currNode();
		if (currNode == null) return;

		//markNodeAsUnread(currNode);
                //no more marking as unread when going to previous message

		var prevMsgNode = channel.msgQueue.prev();
		if (prevMsgNode != null) {
			//select the message in message browser
			//(start by unselecting all presently selected)
			browserTv = channelView.msgBrowserView.treeView;
			browserTv.unselectAll();
			var nvs = prevMsgNode.nodeViews;
			for (var i =0; i<nvs.length;i++) {
				var nv=nvs[i];
				if (nv.treeView==browserTv) {
					nv.multiselect();
					browserTv.area.scrollTop(nv.area[0].offsetTop-20);
					browserTv.area.scrollLeft(nv.area[0].offsetLeft-20);
				}
			}
		}
	}

	this.leave = function () {
		// User has requested to leave the channel
		if (channel == null) return;

		query = {clientId: me.id,
			requestId: requestIdFactory.getId()};

		// send request to server
		$.post('/leave', query, function (data) {
				if (data.success == 'y') {
					channelView.fadeOut( function() {
						//close channel
						//clear messages
						clearChannelView();
						channel = null;
		 		 	 	joinView.fadeIn();
		 		 	 	joinView.find('#join_channel').focus();
		 		 	 });
				} else {
					alert(data.err);
					document.location='/'; //reload page
				}
		});
	}

	this.disconnect = function () {
		// User has requested to disconnect from chat server
		if (me == null) return false;

		var query = {requestId: requestIdFactory.getId(),
			clientId: me.id};
		$.post('/disconnect', query, function(data) {
		 		 if (data.success == 'y') {
		 		 	 me = null;

		 		 	 //stop polling
		 		 	 pollStop();

		 		 	 //show connect
		 		 	 joinView.fadeOut( function() {
		 		 	 	connectView.fadeIn();
		 		 	 	connectView.find('#connect_username').focus();
		 		 	 });
		 		 } else {
		 		 	alert(data.err);
		 		 }
		 }, 'json');
         
		return true;
	}


	this.send = function () {
		// User wants to send a message
		
		// Get message text
		var msgtext = channelView.msgComposerView.find('#response_text').val();
		channelView.msgComposerView.find('#response_text').val('');

        //check if the message composer is empty
		if (msgtext == '') {
                    this.nextMessage(); // Go to next message
                    return false;
        }

		//get parent ids
		var parentIds = [];
		for (var i = 0; i<channel.selection.length; i++) {
			parentIds.push(channel.selection[i].value.id);
		}

		if (parentIds.length == 0)
			if (channel.tree.root != null) return false;

		var query = {
			requestId:requestIdFactory.getId(),
			clientId:me.id,
			text:msgtext,
			'parentIds':parentIds
		}
		// Send request to server
		$.post('/send', query, function (data) {
				if (data.success == 'y') {
					// Show the new message in the main interface
					newNode = messageReceive({
							id:data.msgId,
							clientId:me.id,
							text:msgtext,
							'parentIds':parentIds,
							timestamp: (new Date).getTime()
					});
					focusInMsgDisplay(newNode, true);

					// Make the new node blink in the main interface
					for (var j = 0; j < newNode.nodeViews.length; j++)
						newNode.nodeViews[j].blink('#ffffd4');

					//unselect the nodes that were responded to
					browserNodes = channelView.msgBrowserView.treeView.selection;
					for (i=0; i<browserNodes.length;i++) {
						browserNodes[i].unselect();
					}

					//select the new node...
					selectMsgNode(newNode, false);
				} else {
					alert(data.err);
				}
		}, 'json');

		return true;
	}


	this.help = function () {
		// Display the help window
		$('#shader')
			.unbind('click')
			.fadeIn(function(){
				$('#shader').click(function() {
					$('#help').hide();
					$(this).fadeOut()
				});
				$('#help').css({'left':window.innerWidth/2-250}).show();
			});
	}


	this.selectRoot = function() {
		  // Shows all top level message
		  channelView.msgBrowserView.treeView.rootNodeView.select();
		  $('#response_text').focus();
	}
	// ------ END: PUBLIC METHODS ------


	// ------------------ RESIZE GRIPPIES CODE ------------------
	channelView.msggrippy.mousedown(function(e) {
	   var dv = $(channelView.msgDisplayView.parent());
	   var x = dv.position().left;

	   $(window).mousemove(function(e) {
		   dvwidth = e.pageX-x;
		   bvwidth = channelView.mainView.width - e.pageX - 24;

	   
		   dv.width(dvwidth);
		   channelView.msgBrowserView.width(bvwidth);
		   adjustMessageComposer();
	   });
	   $(window).mouseup(function(e) {
		   $(this).unbind('mousemove');
	   });
	});
	channelView.sidegrippy.mousedown(function(e) {
	   var dv = $(channelView.msgDisplayView.parent());
	   var sb = channelView.sideBarView;

	   $(window).mousemove(function(e) {
		   oldSbWidth = sb.width();
		   sb.width(e.pageX);

		   dv.width(dv.width() - (e.pageX - oldSbWidth));
		   adjustMessageComposer();
	   });
	   $(window).mouseup(function(e) {
		   $(this).unbind('mousemove');
	   });
	});
	// ------------------ END RESIZE GRIPPIES CODE ------------------

	channelView.clientsDisplayView.refresh = function () {
		/* Refresh the list of online users */

		if (channel == null) return false;
		var clients = channel.clients;
		if (clients == null) return false;
		var list = this.find('ul');
		list.children().remove();
		for (var i in clients) {
			if (i == me.id) continue;
			var client = clients[i];
			list.append('<li>'+client.name+'</li>');
		}
        return true;
	}


	// Show a highlighted border around the message composer when it is selected
	$('#response_text').focus( function () {
	    $(this).css({'border':'3px solid #00C0FF'});
	}).blur( function () {
	    $(this).css({'border':''});
	});

	function showMsgComposer () {
		$('#response_text').css({display:''});
	}
	function hideMsgComposer () {
		$('#response_text').css({display:'none'});
	}

	function adjustMessageComposer () {
		// adjust size of message composer to fit inside message display pane
          channelView.msgComposerView.width(
		$(channelView.msgDisplayView.parent()).width()-6);
	}

	// Resize all the window elements each time the window is resized
	function resizeChannelView () {
		var winWidth = $(window).width();

		var viewHeight = $(window).height()-channelView.statusBarView.height()-10;
		if (channelView.msgComposerView.css('display') != 'none')
			viewHeight -= channelView.msgComposerView.height();
		var sbWidth = 180;
		var browserWidth = 400;
		channelView.sideBarView.width(sbWidth);
		channelView.msgBrowserView.width(browserWidth);
		$(channelView.msgDisplayView.parent()).width(winWidth-(sbWidth+browserWidth+18));
		adjustMessageComposer();

		channelView.mainView.height(viewHeight);
	}
	$(window).resize(resizeChannelView); 

	// requestIdFactory : an object generating a new id for every request made to the server
	var requestIdFactory = new function () {
		var nextId = 1;
		this.getId = function () {
			return nextId++;
		}
	}

	var markNodeViewUnread = function(nv) {
		nv.area.addClass('node_unread');
	}
	var markNodeViewRead = function(nv) {
		nv.area.removeClass('node_unread');
	}
	var markNodeAsUnread = function(node){
		node.value.read = false;
		nvs = node.nodeViews;
		for (i=0;i<nvs.length;i++) {
			markNodeViewUnread(nvs[i]);
		}
	}
	var markNodeAsRead = function(node){
		node.value.read = true;
		nvs = node.nodeViews;
		for (i=0;i<nvs.length;i++) {
			markNodeViewRead(nvs[i]);
		}
		//signal to the queue that the node was read
		channel.msgQueue.nodeReadListener(node);
	}



	var msgTreeSettings = new treeSettings( {
			idFunction: function () {
				this.getId=function(node) {
					return node.value.id;
				}
			},
			IdType: MESSAGE_ID_TYPE
	});

	//Called when msg is shown in msgDisplay
	var nodeDisplayedListener = function(node) {
		var nvs = node.getNodeViewsInTreeView(channelView.msgBrowserView.treeView);
		$(nvs).each(function(i,nv) {nv.area.addClass('node_displayed');});

		markNodeAsRead(node);
	}

	// Called when msg disappears from msgDisplay
	var nodeUndisplayedListener = function(node) {
		var nvs = node.getNodeViewsInTreeView(channelView.msgBrowserView.treeView);
		
		var nv_found = false;
		// Set appropriate CSS class on the node views
		$(nvs).each(function(i,nv) {nv.area.removeClass('node_displayed');nv_found = true;} );
		// Apply recursively to children
		if (nv_found) {
			var children = node.children;
			$(children).each(function(i,child) {nodeUndisplayedListener(child);});
		}
	}

	// Called when all messges are removed from message display
	var allNodesUndisplayed = function(node) {
		$('.node_displayed').removeClass('node_displayed');
	}

	var clearMultiParentDisplay = function() {
		channelView.multiParentDisplay.empty();
	}

	// WARNING: THIS IS THE MOST COMPLEX FUNCTION.. and is about 150 lines of code long >-<
	// It is essentially a helper function for selectMsgNode
	// It updates the message display to set focus on the the provided node
	var focusInMsgDisplay = function (node, multi) {
		// note : for every msg displayed in msgDisplay, will apply node_displayed CSS class in msgBrowser
		if (multi==undefined) multi=false;
		displayTv = channelView.msgDisplayView.treeView;
		var selection = channel.selection;
		var mpDisp = channelView.multiParentDisplay;

		if (!multi) {
			displayTv.clear();
			//clear multi-parent display
			clearMultiParentDisplay();
			//mark all nodes as undisplayed
			allNodesUndisplayed();
		} else {
			// Handle case when node added to selection is less deep than currently least deep
			// node shown in the message display. 
			if (!node.hasAncestor(displayTv.rootNodeView.node)) {

				var selnv = focusInMsgDisplay(node, false); // this redraws the msgDisplay tree with correct root 
				selnv.multiselect();
				for (var j=0;j<selection.length;j++) {
					if (selection[j] != node)
						focusInMsgDisplay(selection[j], true).multiselect();
				}
				return selnv;
			}
		}

		var root = node.tree.root;

		// Find first ancestor of selected node with least depth which has multiple parents (or no parents)
		// We call this "topNode"
		// This will be the new root of the MsgDisplay
		var topNode = null;
		if (!multi) {
			var mindepthSelNode = node;
			for (var i=0;i<selection.length;i++) {
				selNode = selection[i];
				if (!selNode.hasAncestor(mindepthSelNode))
					mindepthSelNode = selNode;
			}
			topNode = mindepthSelNode;
			while (topNode != root) {
				if (topNode.parents.length > 1) {
						//draw the multiple parents is multi-parent display area
					var parents = topNode.parents;
					for (var i=0;i<parents.length;i++) {
						var p = parents[i];
						var nvCode = displayTv.nodeViewCode(p);
						nvCode.data('node', parents[i]);

						//function executed when click on 'nodeView' in multi-parent display area
						nvCode.click(function(e) {
							var node = $(this).data('node');
							if (e.shiftKey) {
								 selectMsgNode(node, true);
							} else {
								selectMsgNode(node, false);
							}
						});
						mpDisp.append(nvCode);
						markNodeAsRead(node);
						//blink the fake nodeview?
					}
					break;
				} else {
					topNode = topNode.parents[0];
				}
			}
		}
		
		// This nested function is a helper for focusInMsgDisplay
		// It recursively draws the parents of the node to be focused
		function focusInMsgDisplayHelper(node) { // returns nodeView for this node, draws if neccessary
				if (node.parents == null || node.parents.length == 0) {
						if (displayTv.rootNodeView == null)
							displayTv.drawRoot();
						if (node.value.read == false)
							displayTv.rootNodeView.blink(DEQUEUE_BLINK_COLOR)
						nodeDisplayedListener(displayTv.rootNodeView.node);

						return displayTv.rootNodeView;
				}
				else if (node == topNode) {
					if (displayTv.rootNodeView == null || displayTv.rootNodeView.node != node)
						displayTv.drawAsRoot(node);
					if (node.value.read == false)
							displayTv.rootNodeView.blink(DEQUEUE_BLINK_COLOR)
					return displayTv.rootNodeView;
				} else {
						//all parents are shown:
						for (var i=0;i<node.parents.length;i++) {
							var parentNode = node.parents[i];

							focusInMsgDisplayHelper(parentNode); //upwards recursive call

							for (var j=0;j<parentNode.nodeViews.length;j++) {
								var pnv = parentNode.nodeViews[j];
								if (pnv.treeView == displayTv) {
									var drawnNv = pnv.findChild(node);
									if (drawnNv == null) {
										//node is not drawn, draw it
										drawnNv = displayTv.createNodeView(node);
										pnv.drawChild(drawnNv);

										if (node.value.read == false)
											drawnNv.blink(DEQUEUE_BLINK_COLOR)
										nodeDisplayedListener(node);
									}
									if (node.value.read==false) {
										markNodeAsRead(node);

									}
								}
							}
						}

						return drawnNv;
				}

		}

		var selnv = focusInMsgDisplayHelper(node);

		if (!multi) {
				if (node.parents.length < 2) { // don't draw sibs/children of multiparent messages
					if (DRAW_FOCUS_SIBLINGS) { // draw siblings of the message
							var parent = selnv.parent();
							if (parent != undefined) {
								selnv.remove();
								parent.drawChildren();
								selnv = parent.findChild(node);

								var sibs = parent.children();
								for (var i=0;i<sibs.length;i++) {
										var s = sibs[i];
										if (s.node.value.read == false)
											s.blink(DEQUEUE_BLINK_COLOR)
										nodeDisplayedListener(s.node);
								}
							}
					}
					if (DRAW_FOCUS_CHILDREN) { // draw children of the message
							selnv.drawChildren();
							var children = selnv.children();
							for (var i=0;i<children.length;i++) {
									c = children[i];
									if (c.node.value.read == false)
											c.blink(DEQUEUE_BLINK_COLOR)
									nodeDisplayedListener(c.node);
							}
					}
			}
		}
		// Set scroll position of message Display so that the node is in view
		channelView.msgDisplayView.treeView.area.scrollTop(selnv.area.offset().top-50);
		channelView.msgDisplayView.treeView.area.scrollLeft(selnv.area.offset().left-50);

		return selnv;
	}

	// selectMsgNode: called whenever a message is selected by clicking
	// Adds the node to the selection and updates the UI
	// arg multi: true if adding node to current selection, false (default value) if selecting a node by itself
	var selectMsgNode = function (node, multi) { 
		if (channel.selection.indexOf(node)!=-1)
			return;
		if (multi == undefined) {
                    multi = false;
		}

		if (multi) {
			channel.selection.push(node)
		} else {
			channel.selection = [node]
		}

		if (!multi) {
			//unselect everything in msgdisplay
			displaySel = channelView.msgDisplayView.treeView.selection;
			for (var i =0; i<displaySel.length; i++)
				displaySel[i].unselect();

		}

		focusInMsgDisplay(node, multi);

		var nvs = node.nodeViews;
		for (var i in nvs) {
			if (nvs[i].selected) continue;
			nvs[i].multiselect();
		}

		if (!node.value.read) {
			//mark node as read
			markNodeAsRead(node);
		}

		showMsgComposer();
		$('#response_text').focus();
	}


	
	// ----- BEGIN : PARAMETERS FOR INITIALIZING TREEVIEWS FOR MESSAGE BROWSER AND DISPLAY ----- 
	var tvBrowserEventsParams = { 
		select: function (cb,nv) { // called when a node is selected in the tree
				var node = nv.node;
				var multi = nv.treeView.selection.length > 1;
				selectMsgNode(node, multi);

				cb();
			},
			unselect: function (cb,nv) { // called when a node is removed from selection in the tree
				var sel = channel.selection, nvs = nv.node.nodeViews;
				var index = sel.indexOf(node);
				if (index != -1)
					sel.splice(index,1);
				if (nvs.length > 1) {
					for (var i in nvs) {
						if (nvs[i].selected == false) continue;
						nvs[i].unselect();
					}
				}
				if (sel.length == 0 && nv.treeView.selection.length==0)
					hideMsgComposer();
				cb();
			},
			// Called when a node is clicked
			click: function (cb,nb) {$('#response_text').focus();cb();}
	} ;
	var tvBrowserEvents = new treeViewSettingsEvents(tvBrowserEventsParams);

	var browserMappingFunction =  function() {
		// Maps how node data is mapped to its visual display for the message browser
		this.getMapping = function(node) {
			return {
				id : node.id,
				text : (function () {
						var ret = '';
						var clientId = node.value.clientId;
						if (clientId == me.id) {
							//name = me.name;
							name = 'me';
							ret += '<div><a class="msgbrowser_text" title="'+node.value.text+'"><span style="font-weight:bold;color:green">'+name+'</span>';//+'</div>';
						}
						else {
							var client = channel.clients[node.value.clientId];
							var name;
							if (client == undefined)
								name = '???';
							else
								name = client.name;
							ret += '<div><a class="msgbrowser_text" title="'+node.value.text+'"><span style="font-weight:bold;">'+name+'</span>';//+'</div>';
						}
						ret += ': ';
						var msg_text = node.value.text;
						if (msg_text.length>20)
							msg_text = node.value.text.substr(0,20) + '...'; //max 20 chars of msg to show in disp
						ret += msg_text;
						ret += '</a></div>';
						return ret;
				})()
			}
		}
	}

	var displayMappingFunction =  function() {
		// Maps how node data is mapped to its visual display for the message display
		this.getMapping = function(node) {
			return {
				id : node.id,
				text : (function () {
						var ret = '';
						var clientId = node.value.clientId;
						if (clientId == me.id) {
							//name = me.name;
							name = 'me';
							ret += '<div style="font-size:0.8em;font-weight:bold;color:green">'+name+'</div>';
						}
						else {
							var client = channel.clients[node.value.clientId];
							if (client == undefined)
								client = channel.offline[node.value.clientId];
							var name;
							if (client == undefined)
								name = '???';
							else
								name = client.name;
							ret += '<div style="font-size:0.8em;font-weight:bold">'+name+'</div>';
						}

						ret += node.value.text;
						return ret;
				})()
			}
		}
	}

	var msgBrowserTvSettings = new treeViewSettings( {
			mappingFunction: browserMappingFunction,
			events: tvBrowserEvents
	});

	var tvDispEventsParams = {
			select: function (cb,nv) { 
				 // Called when a node is selected in message display
                var multi = nv.treeView.selection.length > 1;
				selectMsgNode(nv.node, multi);

				// Sync display and browser: unselect any nodes in the browser that
				// aren't selected in the display
				var tvsel = channelView.msgBrowserView.treeView.selection; // The Browser's treeView's selection
				for (var j=0; j< tvsel.length;j++) {
					var display_sel = channelView.msgDisplayView.treeView.selection;
					var doUnselect = true;
					for (var i=0; i<display_sel.length;i++) {
						if (display_sel[i].node == tvsel[j].node) {
							doUnselect=false;
							break;
						}
					}
					if (doUnselect) { tvsel[j].unselect();j--; }
				}
				cb();
			},
			unselect: function (cb,nv) {
				// Called when a node is removed from selection in message display
				var nvs = nv.node.nodeViews;
				for (var i =0; i<nvs.length;i++) {
					currNv = nvs[i];
					currNv.unselect();
				}

				cb();
			},
			click: function (cb,nv) {$('#response_text').focus(); cb();}
	} ;
	var tvDispEvents = new treeViewSettingsEvents(tvDispEventsParams);
	var msgDispTvSettings = new treeViewSettings( {
			autoInsert:false,
			mappingFunction: displayMappingFunction,
			events:tvDispEvents,
			style:'md'
	});
	multiparentControl = new nodeViewControl( {
			 // Icon shown in node view when it represents a message with multiple parents
			 pos: CONTROL_POS_LEFT,
			 css: 'tv_control_multiparent',
			 onClick: function(nodeView) {
				 var parentCount = nodeView.node.parents.length;
				 alert("This message is a reponse to " + parentCount + "messages.");
			 },
			 isVisible: function(nodeView) {
				var node = nodeView.node;
				return node.parents.length > 1;
			 },
			 tooltip: function(nodeView) {
				 var parentCount = nodeView.node.parents.length;
				 return 'Reponse to ' + parentCount + ' messages';
			 }
	})

	showallControl = new nodeViewControl( {
			 // Control shown in node view when it has unshown children (Message Display only)
			 pos: CONTROL_POS_OUTSIDE,
			 css: 'tv_control_out_text',
			 isVisible: function(nodeView) {
					 var childNvs = nodeView.children();
					 return childNvs.length != nodeView.node.children.length;
			 },
			 onClick: function(nodeView) {
					 nodeView.expand();

					 var children = nodeView.children();
					 for (var n in children) {
						nodeUndisplayedListener(children[n].node);
						children[n].remove();
					 }
					 //nodeView.drawChildren();
					 var childNodes = nodeView.node.children;
					 for (n in childNodes) {
						var nv = nodeView.drawChild(nodeView.treeView.createNodeView(childNodes[n]));
						if (!childNodes[n].value.read) {
							markNodeViewUnread(nv);
							nv.blink(DEQUEUE_BLINK_COLOR);
						}
						nodeDisplayedListener( childNodes[n]);

					 }
			 },
			 text: function (nv) {
				 var undrawnCount = nv.node.children.length - nv.children().length;
				 return '+'+undrawnCount;
			 },
			 tooltip: function(nv) {
				 var undrawnCount = nv.node.children.length - nv.children().length;

				 if (undrawnCount==1) ret = 'Show '+undrawnCount+' more response';
				 else ret = 'Show '+undrawnCount+' responses';
				 return ret;
			 }

	})
	msgDispTvSettings.addControl('multiparent', multiparentControl);
	msgBrowserTvSettings.addControl('multiparent', multiparentControl);
	msgDispTvSettings.addControl('showall', showallControl);
	// ----- END : PARAMETERS FOR INITIALIZING TREEVIEWS FOR MESSAGE BROWSER AND DISPLAY -----


	function selectMessageNode(node) {
		browserTv = channelView.msgBrowserView.treeView;
		browserTv.unselectAll();
		var nvs = node.nodeViews;
		for (var i =0; i<nvs.length;i++) {
				//select the message in message browser
				//(start by unselecting all presently selected)
				//TODO : handle multiparent msgs for next and prevMessage
				var nv=nvs[i];
				if (nv.treeView==browserTv){
						nv.multiselect();
						browserTv.area.scrollTop(nv.area[0].offsetTop-20);
						browserTv.area.scrollLeft(nv.area[0].offsetLeft-20);
				}
		}
		markNodeAsRead(node);
	}










	var getHistory = function (cb) {
		// Query the server to get entire message history for the current channel
		// cb = function(msgs) {...} , msgs is null on error
		var msgs = null;
		if (channel == null) cb(msgs);

		var query = {requestId: requestIdFactory.getId(),
			clientId: me.id};
		$.get('/history', query, function(data) {
		 		 if (data.success == 'y') {
		 		 	 cb(data.msgs);
		 		 }
		 		 else {
		 		 	cb(msgs);
		 		 }
		});
	}

	var getClients = function (cb) {
		// Query the server to get clients currently online
		// cb = function(clients), clients is null on error
		var clients = null;
		if (channel == null) cb(clients);

		var query = {requestId: requestIdFactory.getId(),
			clientId: me.id};
		$.get('/clients', query, function(data) {
		 		 if (data.success == 'y') {
		 		 	 cb(data.clients);
		 		 }
		 		 else {
		 		 	cb(clients);
		 		 }
		});
	}


	var clearChannelView = function () {
		// Clear contents of the channel view UI (including message display,
		// message browser, and message queue)
		channelView.msgBrowserView.treeView.area.html('');
		delete channelView.msgBrowserView.treeView;
		channelView.msgDisplayView.find('ul').remove(); // removes the treeView list element
		clearMultiParentDisplay();
		delete channelView.msgDisplayView.treeView;
		channel.msgQueue.close();
	}

	var messageInsertNode = function(msg, markAsRead) {
		// Insert message into the main message tree
		// arguments:
		// msg: the message to insert (received from server or sent by user)
		// markAsRead: if false, the message will be placed into the message queue
		if (markAsRead == undefined) markAsRead = false;
		var tree = channel.tree;

		// Create the node object
		var newNode = tree.createNode(msg);
		// Insert into tree
		if (tree.root == null)
			tree.setRoot(newNode);
		else
		{
			var parentIds = msg.parentIds;
			for (var i = 0; i<parentIds.length; i++) {
				//multiparent code
				var parentNode = tree.getNodeById(parentIds[i]);
				if (parentNode != null) parentNode.append(newNode); //insert in tree
			}
		}

		if (markAsRead)
			msg.read = true;
		else {
			msg.read = false;
			//apply unread style to nodeViews
			markNodeAsUnread(newNode);
			//put in messageQueue if doesn't belong to me
			if (msg.clientId != me.id && newNode.parents.length > 0) {
				channel.msgQueue.insert(newNode);
			}
		}

		return newNode;
	}

	// "Events" for when users join or leave the channel
	var clientJoin = function (client) {
		delete channel.offline[client.id];
		channel.clients[client.id] = client;
		channelView.clientsDisplayView.refresh();
	}
	var clientLeave = function(client) {
		channel.offline[client.id] =  channel.clients[client.id];
		delete channel.clients[client.id];
		channelView.clientsDisplayView.refresh();
	}

	// "Event" for when a message (only text messages, not join or leave) is received from the server
	var messageReceive = function(msg) {
		//returns the node corresponding to the message
		var newNode = messageInsertNode(msg, msg.clientId == me.id ? true : false);
		for (var j = 0; j < newNode.nodeViews.length; j++)
			newNode.nodeViews[j].blink('#ffffd4');

		return newNode;
	}


	var readMessage = function (msg) {
		$('#debug').append('<p> got message: '+JSON.stringify(msg)+'</p>');

		switch (msg.type) {
			case 'join' :
				if (channel == null) break;
				var client = {id: msg.clientId, name: msg.clientName};
				clientJoin(client);
				break;
			case 'leave':
				if (channel == null) break;
				var client = channel.clients[msg.clientId];
				if (client == undefined) break; //tried to remove client not in channel
				clientLeave(client);
				break;
			case 'msg':
				if (channel == null) break;
				var message = {id: msg.id,
						clientId: msg.clientId,
						text: msg.text,
						parentIds: msg.parentIds,
						timestamp: msg.timestamp}

				messageReceive(message);
				break;
			case 'system':
				// Currently there are no system messages
				break;
		}
	}

	var readPoll = function (data) {
		if (data.success != 'y') {
			alert(data.err);
			return;
		}
		if (data.clientId != me.id) {
			throw Error("client id in poll response is not the same as client's id");
		}

		var msgs = data.msgs;
		for (var i = 0; i<msgs.length; i++) {
			readMessage(msgs[i]);
		}
	}


	var pollFunction = function () {
		if (me.id == undefined) throw Error("tried to poll, but user not connected");
		var query = {clientId: me.id
				, requestId:requestIdFactory.getId()
				//, timeout: 5
			    }
		poll_request = $.get('/poll',
				query ,
				 function (data) {
				 	 readPoll(data);
				 	 pollTimer=setTimeout(pollFunction ,POLL_DELAY);
				 },'json');
	}

	var pollStart = function () {
		pollFunction();
	}
	var pollStop = function () {
		if (poll_request != null) poll_request.abort();
		clearTimeout(pollTimer);
	}


	//finally...
	resizeChannelView();
	connectView.fadeIn(1500);
	//GO!
}


// formerly in client.html:
var debugHidden = true;
function toggleDebug() {
	if (debugHidden) {
		$('#debug').show();
		debugHidden = false;
	} else {
		$('#debug').hide();
		debugHidden = true;
	}
}
function clearDebug() {
	$('#debug').html('');
}

var im;
$(document).ready( function () {
		// Initializing of the client application
		im=new IMClient($('#im_main'));
		$('#response_text').keypress(function(e){
		   if (enterKey(e)) {
		   	im.send();
			return false;
		   }
		 });
		$('#newConversation').click( function(e) {
		   im.selectRoot(); 
		});
});

