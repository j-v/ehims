TVEVENT_SRC_UNKNOWN = 0;
TVEVENT_SRC_INPUT = 1;

//TODO: make node added/removed events

var treeViewSettingsEvents = function (params) {
	//params is of format { eventname1: [fun1, fun2], ... }
	// or { eventname1: fun1, ... }
	// eg { click : function (callback, nodeView) { alert('click!'); callback(); } ,
	//      select : [ function (callback, nodeView) { alert('override'); }, function (callback, nodeView) { } ] }
	
	//possibly TODO: add event_args argument to each event, including things like Source (click, keyboard, other..)
	
	//contains funChains for each type of event, eg. select, click...
	this.select = new funChain();
	this.unselect = new funChain();
	this.click = new funChain();
	this.shiftClick = new funChain();
	
	//DEFAULT SETTINGS : to override these, do not call callback() in the function
	//passed to params
	this.click.add(function (callback,nodeView) {
			if (nodeView.hidden) nodeView.show();
			if (nodeView.treeView.selection.indexOf(nodeView)==-1) {
			
				nodeView.select(); 
			}
	;callback(); } );
	this.shiftClick.add( function(callback,nodeView) {
		if (nodeView.selected) nodeView.unselect(); 
		else nodeView.multiselect();	
	} );
	//END OF DEFAULT SETTINGS
	
	
	// APPLY PARAMS
	if (params === undefined) params = {};
	for (var n in params) {
		if (this[n] != undefined){
			if (typeof(params[n])=='object' && params[n].length != undefined) { // is array of functions
				for (var f in params[n]) {
					var fun = params[n][f];
					if (typeof(fun) == 'function') this[n].add(fun);
					else throw Error('Invalid parameter passed to treeViewSettingsEvents');					
				}
			}
			else if (typeof(params[n]) == 'function') {
				this[n].add(params[n]);
			} else {
				throw Error('Invalid parameter passed to treeViewSettingsEvents');
			}
		}
		else throw Error('Invalid parameter passed to treeViewSettingsEvents');
	}
}
