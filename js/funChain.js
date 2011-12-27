// funChain
// created for treeView
// j.volkmar
// 2010

var FUNCHAIN_STYLE_STACK = 0;
var FUNCHAIN_STYLE_QUEUE = 1;

/*
 * each function added to the chain MUST have a 1st parameter 'callback'
 * and SHOULD contain a call to the callback() function
*/

function isArray(obj) {
	if (typeof(obj) != 'object' || obj.length == undefined) return false;
	else return true;	
}

function funChain(style) {
	var style = (style == undefined) ? FUNCHAIN_STYLE_STACK : style; 
	var self = this;
	var functions = [];
	
	
	this.execute = function (args) {
		if (!isArray(args)) args = [args];
		var helper = function (funList,index) {
			
			if (funList[index]==undefined) return function () { };
			switch (style) {
				case FUNCHAIN_STYLE_STACK:
					var aArgs = [helper(funList,index-1)].concat(args);
					return function () { funList[index].apply(this,aArgs); };
					break;
				case FUNCHAIN_STYLE_QUEUE:
					var aArgs = [helper(funList,index+1)].concat(args);
					return function () { funList[index].apply(this,aArgs); };
					break;
				
				
			}
			
		}
		switch (style) {
			case FUNCHAIN_STYLE_STACK:
				helper(functions,functions.length-1)();
				break;
			case FUNCHAIN_STYLE_QUEUE:
				helper(functions,0)();
				break;
		}
	}
	
	this.add = function (fun) {
		if (typeof(fun) != 'function')
			throw new Error('value passed to funChain.add() must be a function.');
			
		functions.push(fun);		
	};
	
	this.remove = function (fun) {
		if (typeof(fun) != 'function')
			throw new Error('value passed to funChain.remove() must be a function.');
			
		var index = functions.indexOf(fun);
		if (index == -1) return;
		functions.splice(index,1);
	}
	
	this.clear = function () {
		functions = [];		
	}
	
	
	styleTypes = [FUNCHAIN_STYLE_STACK, FUNCHAIN_STYLE_QUEUE];
	
	this.setStyle = function (s) {
		if (styleTypes.indexOf(s) == -1)
			throw new Error("funChain.setStyle error: Invalid style type."); 
		style = s;
	}	
}
