var CONTROL_POS_LEFT = 0;
var CONTROL_POS_RIGHT = 1;
var CONTROL_POS_OUTSIDE = 2;

var nodeViewControl = function (params) { //control that appears in the nodeView
	if (params == undefined) params = {};
	
	var defaults = {
		pos : CONTROL_POS_LEFT,
		css : '',
		onClick : function (nodeView) { throw notImplementedError; },
		isVisible : function (nodeView) { return true; },
		text: function (nodeView) {return '';},
                tooltip: function(nodeView) {return '';}
	}
	
	for (param in defaults) {
		this[param] = params[param] == undefined ?
			defaults[param] : params[param];
	}
}
