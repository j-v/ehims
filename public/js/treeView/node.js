var node = function (value) {
	var self = this;
	
	this.value = value;
	this.parents = [];
	this.children = [];
	this.id = '';
	this.tree = null;
	this.depth = undefined; //is actually MIN depth, since a node can have multiple parents
	this.nodeViews = []; 
	this.allowMultiParent = true; //this should really be only set by tree.createNode
	this.selected = false;
	
	this.remove = function() { //deletes node and all children, and assoc. nodeViews
		// q. what delete events to implement
		
		// delete children
		var children = this.children;
		while (children.length > 0) children[0].remove();
		
		var t = this.tree
		if (t != null) {
			var nodeIndex = t.nodes.indexOf(this);
			t.nodes.splice(nodeIndex,1);
			if (t.root == this) {
				//removing root node	
				t.root = null;
				if (t.treeView != null) t.treeView.rootNodeView = null;
			}
		}
		var parents = this.parents;
		for (var n in parents) {
			parents[n].children.splice(parents[n].children.indexOf(this),1);
		}
		var nodeViews = this.nodeViews;
		if (nodeViews != null && nodeViews.length > 0) {
		//delete, unselect nodeviews
		for (var n in nodeViews) {
			nodeViews[n].remove();
		}
			
		}	
		
		// also, at some point consider memory usage...
	}
	
	var setNodeTree = function (node, tree) { //not sure if this function is useful
		// sets node.tree = tree for node and all its children
		// and adds node to tree's node list
		node.tree = tree;
		var children = node.children;
		tree.nodes.push(node);
		if (children != null) {
			for (n in children) setNodeTree(children[n], tree);
		}
	}
	
	var validateNode = function (node) {
		if (node.tree != self.tree) {			
			throw new Error("Tried to insert node into tree, but node is from different tree");
		}
		if (node.parents.length > 0 && !node.allowMultiParent) {
			throw new Error("Tried to insert node into tree, but parent node does not support multiple parents");
		}
		return true;
	}
	
	var insertNodeHelper = function (node) { //poss use apply instead of node (node becomes this)
                if (node.depth == undefined || node.depth > self.depth)
                    node.depth = self.depth + 1;
		if (node.tree == null) {
			setNodeTree(node,tree);
		}
		else if (node.tree == self.tree) { 
			//draw node in tree
			//possibly put it in the addnode event chain
			var treeViews = node.tree.treeViews;
			if (treeViews == null || treeViews.length == 0) throw Error("There is no treeView");
			
			
			
			//create a nodeView for every nodeView the parent has
			var parNodeViews=self.nodeViews;
			for (var n in parNodeViews) {
				var treeView = parNodeViews[n].treeView;
				if (!treeView.settings.autoInsert) continue;
				if (treeView.settings.multiParentStyle == TREEVIEW_MULTIPARENTSTYLE_STANDARD) {
					var nv = treeView.createNodeView(node);
					//node.nodeViews.push(nv); //is in constructor instead
					//draw
					parNodeViews[n].drawChild(nv);
					
				} else {
					//code for new multiparent style
					throw notImplementedError;
				}
				
			}
			
			
			
			
			//throw notImplementedError;
		} else {
			throw Error("Tried to insert node into tree, but node is from different tree ");
		}
	}
	
	this.append = function (node) {
		if (!validateNode(node)) return;		
		
		node.parents.push(this);		
		this.children.push(node);
		
		insertNodeHelper(node);		
	}
	
	this.prepend = function (node) {
		if (!validateNode(node)) return;
		
		node.parents.push(this);		
		this.children.unshift(node);
		
		insertNodeHelper(node);
	}
	
	this.getNodeViewsInTreeView = function(treeView) {
		//returns an array of nodeViews for this node in the specified treeView
		var ret = [];
		var nvs = this.nodeViews;
		for (var i=0;i<nvs.length;i++) {
			var nv = nvs[i];
			if (nv.treeView == treeView) 
				ret.push(nv);
		}
		return ret;
	}
	
	this.hasAncestor = function(node) {
            var parents = this.parents;
            if (parents == null || parents.length ==0)
                return false;
            else {
                //breadth first implementation
                for (var i=0;i<parents.length;i++) {
                    var parent = parents[i];
                    if (parent == node)
                        return true;
                }
                for (i=0;i<parents.length;i++) {
                    if (parents[i].hasAncestor(node))
                        return true;
                }
                return false;
            }
        }
	
}

