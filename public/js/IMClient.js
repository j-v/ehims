//IMClient.js
// j volkmar 2010

var notImplementedError = Error('not implemented');

var POLL_DELAY = 50; //(ms)

var DEQUEUE_BLINK_COLOR = "#DDF";

DRAW_FOCUS_CHILDREN = true;
DRAW_FOCUS_SIBLINGS = true;
MESSAGE_ID_TYPE = String;

var defaultIMClientParams = {};

function enterKey(event) { //returns true if enter is pressed
	if (event.keyCode == 13) return true;
        else return false;
}



var IMClient = function (mainElement, params) {
	if (mainElement == null) throw Error("Must specify a jquery object as mainElement (1st arg in IMClient constructor)");

        var poll_request = null;

	var nodeQueue = function () {
		var view = channelView.msgQueueView;
		var enabled = false;
		var pos = 0;
		var node_arr = [];
		var curr_node = null;

		this.enable = function() {enabled=true;}
		this.disable = function() {enabled = false;}
		this.insert = function (node) {
			if (!enabled) return;
			node_arr.push(node);
                        var nodeLi = $('<li class="queuedNode">'+itemHtml(node)+'</li>');
                        nodeLi.click(function() {
                            selectMessageNode(node);
                        })
			view.find('ul').append(nodeLi);
		}
		this.next = function () {
			//return node at next position, advance pos


			while (true) { //go to node that isn't yet read
				if (!(pos < node_arr.length)) return null;
				var retnode = node_arr[pos];
				curr_node = retnode; //remove?
				pos++;
				$(view.find('ul').children()[0]).remove();
				if (retnode.value.read == false) {
					setCurrent(retnode);
					return retnode;
				}
			}




		}
		this.prev = function() {
			if (curr_node != null) {
                                msgLi = $('<li>'+itemHtml(curr_node)+'</li>');

				view.find('ul').prepend(msgLi);

                        }
			if (pos > 0) {
				//place current node back in queue
				pos--;
				var retnode = null;
				if (pos>0) {
					retnode = node_arr[pos-1];
				}
//				else
//					var retnode = null;
//
//					//retnode = node_arr[pos];
//					//view.find('ul').prepend('<li>'+retnode.value.id+'</li>');
//			}
//			else
//			{
//				retnode = null;
//			}
			setCurrent(retnode);
                        }
			return retnode;
		}
		this.currNode = function () {
			return curr_node;
		}
		this.close = function() {
			node_arr = [];
			view.find('ul').empty();
		}
		function setCurrent(node) {

			curr_node=node;
			var curr_text;
			if (node == null)
				curr_text = '';
			else
				curr_text = itemHtml(node);
			view.find('#current_msg').text(curr_text);
		}
		function itemHtml(node) {
			var msg = node.value;
			var client = getClientById(msg.clientId);

			var clientName;
                        clientName = client == null ?
                            '?' : //has happened, but shouldn't
                            client.name;
			var text = msg.text.length > 15 ? msg.text.substr(0,15) + '...' : msg.text;
			return clientName + ": " + text;
		}

		//listeners (might implement newnode listener)
		this.nodeReadListener = function(node) {
			//called when a node is marked as read in the main view
			//look through the node_arr and remove the node
			for (var i=0; i<(node_arr.length-pos); i++) {
				var currnode=node_arr[pos+i];
				if (currnode==node) {
					//$(view.find('ul').children()[i]).css({'text-decoration':'line-through'});
                                        $(view.find('ul').children()[i]).fadeOut();
					break;
				}
			}
		}
	}

	//set default params
	for (var i in defaultIMClientParams) {
		if (params[i] == undefined) params[i] = defaultIMClientParams[i];
	}
	//apply params

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


        // ------------------ RESIZE GRIPPIES CODE ------------------
        channelView.msggrippy.mousedown(function(e) {
           var dv = channelView.msgDisplayView;
           var x = dv.position().left;

           $(window).mousemove(function(e) {
               dvwidth = e.pageX-x;
               bvwidth = channelView.mainView.width() - e.pageX - 24;

               dv.width(dvwidth);
               channelView.msgBrowserView.width(bvwidth);
           });
           $(window).mouseup(function(e) {
               $(this).unbind('mousemove');
           });
        });
        channelView.sidegrippy.mousedown(function(e) {
           var dv = channelView.msgDisplayView;
           var sb = channelView.sideBarView;

           $(window).mousemove(function(e) {
//               var xpos = dv.position().left;
//               var offset = sb.width() - xpos;
               oldSbWidth = sb.width();
               sb.width(e.pageX);

               dv.width(dv.width() - (e.pageX - oldSbWidth));
           });
           $(window).mouseup(function(e) {
               $(this).unbind('mousemove');
           });
        });
        // ------------------ END RESIZE GRIPPIES CODE ------------------

	channelView.clientsDisplayView.refresh = function () {
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


	$('#response_text').focus( function () {
	    $(this).css({'border':'3px solid #00C0FF'});
	}).blur( function () {
	    $(this).css({'border':''});
	});

	function showMsgComposer () {
		$('#response_text').css({display:''});
		//resizeChannelView();
		//$('#response_text').show(function() {resizeChannelView();});
		/*
		channelView.msgComposerView.show( function () {
				resizeChannelView();
		}
		);	*/
	}
	function hideMsgComposer () {
		$('#response_text').css({display:'none'});
		//resizeChannelView();
		//$('#response_text').hide(function() {resizeChannelView();});
		/*
		channelView.msgComposerView.hide( function () {
				resizeChannelView();
		}
		);*/
	}

	function resizeChannelView () {
		var winWidth = $(window).width();

		var viewHeight = $(window).height()-channelView.statusBarView.height()-35;
		if (channelView.msgComposerView.css('display') != 'none')
			viewHeight -= channelView.msgComposerView.height();
		/*
		channelView.msgBrowserView.height(viewHeight);
		channelView.msgDisplayView.height(viewHeight);
		channelView.sideBarView.height(viewHeight);
		*/
		channelView.sideBarView.width(180);
		channelView.msgBrowserView.width(300);
		channelView.msgDisplayView.width(winWidth-498);

		channelView.mainView.height(viewHeight);

	}
	$(window).resize(resizeChannelView);

	//requestIdFactory
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
			//nvs[i].area.addClass('node_unread');
		}
		//signal to the queue?
	}
	var markNodeAsRead = function(node){
		node.value.read = true;
		nvs = node.nodeViews;
		for (i=0;i<nvs.length;i++) {
			markNodeViewRead(nvs[i]);
			//nvs[i].area.removeClass('node_unread');
		}
		//signal to the queue?
		channel.msgQueue.nodeReadListener(node);
	}

	//CONTROLS
	this.connect = function () {
		var username = connectView.find('#connect_username').val();
		if (username == '') return;

		var query = {requestId: requestIdFactory.getId()
				 , name: username};
		 $.post('/connect', query, function(data) {
		 		 if (data.success == 'y') {
		 		 	 me = {name : username, id : data.clientId};

		 		 	 //start polling
		 		 	 //pollStart();

		 		 	 //show join
		 		 	 connectView.fadeOut( function() {
		 		 	 	joinView.fadeIn();
		 		 	 	joinView.find('#join_channel').focus();
		 		 	 });
		 		 } else {
		 		 	alert(data.err);
		 		 }
		 }, 'json');
		//throw notImplementedError;
	}


	var msgTreeSettings = new treeSettings( {
			idFunction: function () {
				this.getId=function(node) {
					return node.value.id;
				}
			},
			IdType: MESSAGE_ID_TYPE
	});

	var nodeDisplayedListener = function(node) {
		//called when msg is shown in msgDisplay
		var nvs = node.getNodeViewsInTreeView(channelView.msgBrowserView.treeView);
		$(nvs).each(function(i,nv) {nv.area.addClass('node_displayed');});

                //mark node as read
                markNodeAsRead(node);
	}
	var nodeUndisplayedListener = function(node) {
		//called when msg is removed from msgDisplay
		var nvs = node.getNodeViewsInTreeView(channelView.msgBrowserView.treeView);
		//will apply recursive to children
		var nv_found = false;
		$(nvs).each(function(i,nv) {nv.area.removeClass('node_displayed');nv_found = true;});
		if (nv_found) {
			var children = node.children;
			$(children).each(function(i,child) {nodeUndisplayedListener(child);});
		}
	}
        var allNodesUndisplayed = function(node) {
            $('.node_displayed').removeClass('node_displayed');
        }

        var clearMultiParentDisplay = function() {
            channelView.multiParentDisplay.empty();
        }

	var focusInMsgDisplay = function (node, multi) {
		//for every msg displayed in msgDisplay, will apply node_displayed in msgBrowser
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
                    //handle case when node added to selection is less deep than currently least deep
                    //selected node

                    if (!node.hasAncestor(displayTv.rootNodeView.node)) {

                        var selnv = focusInMsgDisplay(node, false);
                        selnv.multiselect();
                        for (var j=0;j<selection.length;j++) {
                            //displayTv.selection = [];
//                            for (var k=0; k<selection.length; k++) {
//                                displayTv.selection.push(selection[k])
//                            }

                            if (selection[j] != node)
                                focusInMsgDisplay(selection[j], true).multiselect();
                        }
                        return selnv;
                    }
                }

		var root = node.tree.root;

                //find first ancestor of selected node with least depth which has multiple parents
                var topNode = null;
                if (!multi) {
                    var mindepthSelNode = node;
                    for (var i=0;i<selection.length;i++) {
                        selNode = selection[i];
//                        if (selNode.depth<mindepthSelNode.depth)
//                            mindepthSelNode = selNode;
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

                function helper(node) { //returns nodeView for this node, draws if necc
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
                                    helper(parentNode); //upwards recursive call
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
//                                                    if (!multi) {
//                                                            var siblings = drawnNv.siblings();
//                                                            for (var k=0; k<siblings.length; k++) {
//                                                                    nodeUndisplayedListener(siblings[k].node);
//                                                                    siblings[k].remove();
//
//                                                            }
//                                                    }
                                        }
                                    }
                                }

                                return drawnNv;
                        }

                }
                var selnv = helper(node);
                //got the nodeview to focus
                if (!multi) {
                        if (node.parents.length < 2) {
                            if (DRAW_FOCUS_SIBLINGS) {
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
                            if (DRAW_FOCUS_CHILDREN) {
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
                channelView.msgDisplayView.treeView.area.scrollTop(selnv.area.offset().top-50);

		return selnv;
	}
	var selectMsgNode = function (node, multi) { //multi: true if adding node to current selection, false by default
		//var msg = node.value;
		if (channel.selection.indexOf(node)!=-1)
			return;
		if (multi == undefined) {
			//multi = channel.selection.length != 0 ? true : false;
//                        multi = channel.selection.length > 0 ? true : false;
                    multi = false;
		}
		//channel.selection.push(node);

		if (multi) {
			channel.selection.push(node)
		} else {
			channel.selection = [node]
		}

		//if (multi == undefined) multi = false;
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
	function getClientById(id) {
		var client = channel.clients[id];
		if (client != undefined) return client;
		client = channel.offline[id];
		if (client != undefined) return client;
		return null;
	}

	var tvBrowserEventsParams = {
			select: function (cb,nv) {
				var node = nv.node;
                                var multi = nv.treeView.selection.length > 1;
				selectMsgNode(node, multi);

				cb();
			},
			unselect: function (cb,nv) {
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
			click: function (cb,nb) {$('#response_text').focus();cb();}
	} ;
	var tvBrowserEvents = new treeViewSettingsEvents(tvBrowserEventsParams);
	var browserMappingFunction =  function() {
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
                                var multi = nv.treeView.selection.length > 1;
				selectMsgNode(nv.node, multi);
				//sync display and browser
				//var sel = channel.selection;
				var tvsel = channelView.msgBrowserView.treeView.selection;
				for (var j=0; j< tvsel.length;j++) {
					var browsersel = channelView.msgDisplayView.treeView.selection;
					var doUnselect = true;
					for (var i=0; i<browsersel.length;i++) {
						if (browsersel[i].node == tvsel[j].node) {
							doUnselect=false;
							break;
						}
					}
					if (doUnselect) {tvsel[j].unselect();j--;}
				}
				cb();
			},
			unselect: function (cb,nv) {

				var nvs = nv.node.nodeViews;
				for (var i =0; i<nvs.length;i++) {
					currNv = nvs[i];
					currNv.unselect();
				}

				cb();
			},
			click: function (cb,nb) {$('#response_text').focus();cb();}
	} ;
	var tvDispEvents = new treeViewSettingsEvents(tvDispEventsParams);
	var msgDispTvSettings = new treeViewSettings( {
			autoInsert:false,
			mappingFunction: displayMappingFunction,
			events:tvDispEvents,
			style:'md'
	});
        multiparentControl = new nodeViewControl( {
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

	this.join = function () {
		var channelname = joinView.find('#join_channel').val();
		query = {clientId: me.id,
			requestId: requestIdFactory.getId(),
			channelName: channelname};
		//hide the join prompt window
		joinView.fadeOut( function () {

		loadingMsg.show();



		$.post('/join', query, function(data) {

				if (data.success == 'y') {
					pollStop();

					channel = {name: data.channelName,
						   clients : {},
						   offline : {}, //clients who have participated but who are not currently in the channel
						   tree : new tree(msgTreeSettings),
						   selection : [],
						   msgQueue : new nodeQueue()
						};

					channelView.msgBrowserView.treeView =
						new treeView(channel.tree, channelView.msgBrowserView, msgBrowserTvSettings );
					channelView.msgDisplayView.treeView =
							new treeView(channel.tree, channelView.msgDisplayView, msgDispTvSettings );


					//var root =  channel.tree.createNode('root'); channel.tree.setRoot(root);
					channelView.statusBarView.children('#status_info').html('name: <span style="color:white">' + me.name + '</span> channel: <span style="color:white">' + channel.name + '</span>');
					//load history
					getHistory(function (msgs) {
						if (msgs==null) {} //some error
						else {
							$('#debug').append('<p>reading history</p>');
							var myLastMsgIndex = 0;
							//2 passes through messages
							//1. find which msg user had last seen (to know which to mark as read)
							//2. build message tree
							for (var i =0; i< msgs.length; i++) {
								var msg = msgs[i];
								if (msg.type == 'leave' && msg.clientId==me.id) {
									myLastMsgIndex = i;
								}
							}
							for (var i =0; i< myLastMsgIndex; i++) {
								var msg = msgs[i];
								//$('#debug').append('<p>retrieved msg: '+JSON.stringify(msgs[i])+'</p>');
								if (msg.type == 'msg') {
									messageInsertNode(msg, true ); //not readMessage, which makes it blink
								} else {
									readMessage(msgs[i]);

								}
							}
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

							$('#debug').append('<p>finished reading history</p>');
						}

						for (c in channel.clients)
                                                    channel.offline[c] = channel.clients[c]
						channel.clients = {}; //clients was filled while reading messages in getHistory

						//load clients
						getClients(function (clients) {
							if (clients == null) {} //some error
							else {
								var chanClients = channel.clients;
								for (var i = 0; i<clients.length; i++) {
									var client = clients[i];
									if (client.id == me.id) continue;
									chanClients[client.id] = client;
								}
								channelView.clientsDisplayView.refresh();
							}

							loadingMsg.hide( function() {
								pollStart();
								channel.msgQueue.enable();

								channelView.fadeIn(function() {
									showMsgComposer();
									resizeChannelView();

									if (channel.tree.root == null) {
										//showMsgComposer();
										$('#response_text').focus();
									}
									else
										hideMsgComposer();

									//resizeChannelView();
								});
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
                    }
            }
            markNodeAsRead(node);
        }
	this.nextMessage = function() {
		if (channel == null) return;

		var nextMsgNode = channel.msgQueue.next();
		if (nextMsgNode != null) {
			selectMessageNode(nextMsgNode);

		}
	}
	this.prevMessage = function() {
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
				}
			}
		}
	}
	this.leave = function () {
		if (channel == null) return;

		query = {clientId: me.id,
			requestId: requestIdFactory.getId()};

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
		//throw notImplementedError;
	}
	this.disconnect = function () {
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
		var msgtext = channelView.msgComposerView.find('#response_text').val();
		channelView.msgComposerView.find('#response_text').val('');

                //check if the message composer is empty
		if (msgtext == '') {
                    this.nextMessage();
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
		$.post('/send', query, function (data) {
				if (data.success == 'y') {
					newNode = messageReceive({
							id:data.msgId,
							clientId:me.id,
							text:msgtext,
							'parentIds':parentIds,
							timestamp: (new Date).getTime()
					});

					focusInMsgDisplay(newNode, true);
					for (var j = 0; j < newNode.nodeViews.length; j++)
						newNode.nodeViews[j].blink('#ffffd4');
					//selectMsgNode(newNode, false);

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
            $('#shader')
                //.css({'width':'100%','height':'100%'})
                .unbind('click')
                .fadeIn(function(){
                    $('#shader').click(function() {
                        $('#help').hide();
                        $(this).fadeOut()
                    });
                    $('#help').css({'left':window.innerWidth/2-250}).show();

                });

        }

	var getHistory = function (cb) {
		//cb = function(msgs), msgs is null on error
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
		//cb = function(clients), clients is null on error
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
		//clear treeview
		channelView.msgBrowserView.treeView.area.html('');
		delete channelView.msgBrowserView.treeView;
		//channelView.msgDisplayView.treeView.area.html('');
                channelView.msgDisplayView.find('ul').remove(); // removes the treeView list element
                clearMultiParentDisplay();
		delete channelView.msgDisplayView.treeView;
		channel.msgQueue.close();
	}

	var messageInsertNode = function(msg, markAsRead) {
		if (markAsRead == undefined) markAsRead = false;

		//insert message into tree
		var tree = channel.tree;


		var newNode = tree.createNode(msg);
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
			if (msg.clientId != me.id) {
				channel.msgQueue.insert(newNode);
			}
		}

		return newNode;
	}

	//"EVENTS"?
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

	var messageReceive = function(msg) {
		//returns the node corresponding to the message
		var newNode = messageInsertNode(msg, msg.clientId == me.id ? true : false);
		for (var j = 0; j < newNode.nodeViews.length; j++)
			newNode.nodeViews[j].blink('#ffffd4');



		return newNode;
	}
	//END EVENTS


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

	//initialize
	var me = null;
	/* set to {
		name: null,
		id: null,
		channelName: null
	} on connect */
	var channel = null; //set to {name, clients ...}
	var pollTimer = null;
	resizeChannelView();

	//finally...
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
		im=new IMClient($('#im_main'));
		$('#response_text').keypress(function(e){
		   if (enterKey(e)) {
		   	im.send();
			return false;
		   }
		 });
});

