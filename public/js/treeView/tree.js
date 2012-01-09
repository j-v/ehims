var tree = function (settings) { // idFunction must have getId(node) method
	var self = this;

	this.treeViews = [];
	this.root = null;
	this.settings = settings == undefined ? new treeSettings() : settings;
	this.idFunction = new this.settings.idFunction;
	this.id = '';
	this.nodes = [];


	this.createNode = function(value) {
		var newnode = new node(value);
		newnode.tree = this;
		var settings = this.settings;
		newnode.id = this.idFunction.getId(newnode);
		newnode.allowMultiParent = settings.allowMultiParent;
		this.nodes.push(newnode); //should this be here, or only happen when node is actually inserted?
		return newnode;
		//throw notImplementedError;
	}

	this.setRoot = function(node) {
		if (node.tree != this)
			throw Error("Tried set a tree's root node to a node that doesn't belong to that tree.");

		this.root = node;
                node.depth = 0;
		var treeViews = this.treeViews;
		if (treeViews != null) {
			for (var n in treeViews)
				if (treeViews[n].settings.autoInsert) treeViews[n].drawRoot();
		}
	}

	this.getNodeById = function (id) {
	   	id = this.settings.IdType(id);

		//id = Number(id);
		var nodes = this.nodes;
		for (var i =0; i<nodes.length; i++) {
			var node = nodes[i];
			if (node.id == id) return node;
		}
		return null;
	}

}
