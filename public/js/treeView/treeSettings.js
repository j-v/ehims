var treeSettings = function (params) {
	/*
	members description:
	idFunction : class with getId(node) fn returning the id for a newly created node
    allowMultiParent : true or false
	*/

	var defaults = {
		idFunction : function() { // auto increment
			var lastId = 0;
			this.getId = function(node) { return lastId++; }
		},
		allowMultiParent : true,
		IdType: String
	}

	if (params == undefined) params = {};
	//apply settings, using defaults if necessary
	for (var setting in defaults) {
		this[setting] = params[setting] == undefined ?
			defaults[setting] :
			params[setting];
	}
}
