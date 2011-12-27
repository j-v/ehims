

var treeView = function (tree, area, settings) {
	var self = this;
	
	if (tree == null) throw Error("You must specify a tree to create a new treeView.");
	if (area == null) throw Error("You must specify an area (i.e. jquery object) where to create the treeView.");
	
	this.tree = tree;
	this.area = area;
	tree.treeViews.push(this);
	this.rootNodeView = null;	
	this.selection=[];
	this.settings = (settings == undefined ) ? new treeViewSettings : settings;
	this.mappingFunction = new this.settings.mappingFunction;
	this.styleSuffix = this.settings.style == '' ? '' : '_' + this.settings.style; 
	
	var nodeViews = [];
	this.nodeViews = nodeViews;
	
	//initialize area
	this.area.addClass('tv');
	
	this.createNodeView = function(node) {		
		//make a nodeView object and draw it
		//potentially, this could be a recursive function acting on the
		//node's children
		
		if (node == undefined) throw Error("Must specify a node to use for createNodeView(node)");		
		
		var ret = new nodeView(node,this);
		nodeViews.push(ret);
		
		return ret;
	}	
	
	
	
	this.drawRoot = function() {
		//used at initialization		
		
		var rootNode = this.tree.root;
		if (rootNode == null) return;

        this.drawAsRoot(rootNode);
		
	}

    //unsafe: function does not check if there is already a root node drawn
    this.drawAsRoot = function(node) {
            if (node.tree != this.tree)
                throw Exception('Node is not from the same tree');

            if ( this.rootNodeView == null || this.rootNodeView.node != node)
            {
                delete this.rootNodeView;
                this.rootNodeView = this.createNodeView(node);
            }
            //draw root		

            var ss=this.styleSuffix;

            var insertLi = $('<li class="tv_li'+ss+'"></li>');
            insertLi.append(this.rootNodeView.area);
            insertLi.append('<div class="tv_node_controls_out'+ss+'"></div>');
            insertLi.append('<div style="clear:both"></div>');

            var insertUl = $('<ul class="tv_ul'+ss+' tv_ul_root'+ss+'"></ul>');
            insertUl.append(insertLi);
            this.area.append(insertUl);

            this.rootNodeView.redrawControls();

    }
	
	this.unselectAll = function() {
		var sel = this.selection;
		for (var i=0; i<sel.length; i++) {
			sel[i].unselect();
		}
	}

        this.clear = function() {
            if (this.rootNodeView != null) {
                this.rootNodeView.remove();
            }
        }

        this.nodeViewCode = function(node) { //returns jquery object for the nodeView's area
                var mappings = this.mappingFunction.getMapping(node);

		var ss = this.styleSuffix;
		var nodeDiv = $('<div class="tv_node'+ss+'" id="'+mappings.id+'"><div>');

		
		var icon = $('<div class="tv_node_icon'+ss+'"></div>');
		var mainArea = $('<div class="tv_node_main'+ss+'">'+mappings.text+'</div>');

		nodeDiv.append('<div class="tv_node_controls_l'+ss+'"></div>');
		nodeDiv.append('<div class="tv_node_controls_r'+ss+'"></div>');

        var nodeHoverInFn = function () {$(this).children('.tv_node_controls_r'+ss).show();};
		var nodeHoverOutFn = function () {$(this).children('.tv_node_controls_r'+ss).hide();};

		nodeDiv.hover(nodeHoverInFn, nodeHoverOutFn);
		nodeDiv.append(icon);
		nodeDiv.append(mainArea);

		return nodeDiv;
	}
	
	this.drawRoot();
	
	
}
