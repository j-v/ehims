
var MessageQueue = function (queueView, channel, selectCallback) {
	/* MessageQueue Class, stores unread messages for a channel
	 * arguments:
	 * queueView: jQuery element to be used as the view for the messages in the queue
	 * channel: the channel this queue is storing messages for
	 * selectCallback: function(node) { ... } A function with a single argument
	 * 	to be called when a message in the queue is selected
	 */
	
	var view = queueView;
	var channel = channel;
	var enabled = false; // We start disabled until all read messages are loaded in channel
	var pos = 0;
	var node_arr = [];
	var curr_node = null;
	var selectCallback = selectCallback;

	this.enable = function() {enabled=true;}
	
	this.disable = function() {enabled = false;}
	
	this.insert = function (node) {
		if (!enabled) return;
		node_arr.push(node);
		var nodeLi = $('<li class="queuedNode">'+itemHtml(node)+'</li>');
		//nodeLi.click(function() {
		//    selectMessageNode(node);
		//})
		nodeLi.click(function() { 
			selectCallback(node);  
		});
		view.find('ul').append(nodeLi);
	}
	this.next = function () {
		//return node at next position, advance position
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
		var client = channel.getClientById(msg.clientId);

		var clientName;
		clientName = client == null ?
		    '?' : //has happened, but shouldn't
		    client.name;
		var text = msg.text.length > 15 ? msg.text.substr(0,15) + '...' : msg.text;
		return clientName + ": " + text;
	}

	//listeners 
	//called when a node is marked as read in the main view
	this.nodeReadListener = function(node) {
		
		//look through the node_arr and remove the node from the queue
		for (var i=0; i<(node_arr.length-pos); i++) {
			var currnode=node_arr[pos+i];
			if (currnode==node) {
				$(view.find('ul').children()[i]).fadeOut(); // Nice fade out effect
				break;
			}
		}
	}
}
