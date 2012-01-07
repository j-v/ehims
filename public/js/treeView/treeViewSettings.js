var TREEVIEW_MULTIPARENTSTYLE_STANDARD = 0;

var treeViewSettings = function (params) {
	/* 
	members description:
	[ X- means pending deletion ]
	
	controls : array (not really, objects are named so the array is actually an object) of objects type nodeViewControl
	X-addmode : either TREE_MODE_APPEND or TREE_MODE_PREPEND
	events : object of type treeViewSettingsEvents, has funChain members
		 - determines what happens on events such as select, click ...
	multiselect : can user select multiple nodeViews? true or false
	multiParentStyle : only TREEVIEW_MULTIPARENTSYLE_STANDARD for now
	mappingFunction : sets initial values for a created nodeView based on
		node properties. type function() { member fn getMapping(node) returns {id, text... }
	style : suffix to add to css style name
	*/
	
	var defaults = {
		controls : { /*
			     'del': new nodeViewControl( { 
					pos: CONTROL_POS_RIGHT,
					css: 'tv_control_del',
					onClick: function(nodeView) { nodeView.node.remove(); }
					
				}),
				*/
			     'expand' : new nodeViewControl( {
			     		     pos: CONTROL_POS_LEFT,
			     		     css: 'tv_control_expand',
			     		     onClick: function(nodeView) {nodeView.expand(); },
			     		     isVisible: function(nodeView) {
			     		     	var shown = false;
			     		     	var children = nodeView.children();
			     		     	for (var n in children) {
			     		     		if (!children[n].hidden) {shown=true; break;}	
			     		     	}
			     		     	if (!shown) return false;
			     		     	return (nodeView.node.children.length > 0) && 
			     		     	       (nodeView.state == NODEVIEW_STATE_COLLAPSED);
			     		     },
                                             tooltip: function(nv) {return 'Expand'}
				    }),
			     'collapse' : new nodeViewControl( {
			     		     
			     		     pos: CONTROL_POS_LEFT,
			     		     css: 'tv_control_collapse',
			     		     onClick: function(nodeView) {nodeView.collapse(); },
			     		     isVisible: function(nodeView) {
			     		     	var shown = false;
			     		     	var children = nodeView.children();
			     		     	for (var n in children) {
			     		     		if (!children[n].hidden) {shown=true; break;}	
			     		     	}
			     		     	if (!shown) return false;
			     		     	return (nodeView.node.children.length > 0) && (nodeView.state == NODEVIEW_STATE_EXPANDED);
			     		     },
                                             tooltip: function(nv) {return 'Collapse'}
				    }),
			     /*
			     'encapsulate' : new nodeViewControl( {
			     		     pos: CONTROL_POS_RIGHT,
			     		     css: 'tv_control_encap',
			     		     isVisible: function(nodeView) {return nodeView.treeView==tv;},
			     		     onClick: function(nodeView) {
			     		     	     //show only parents and children
			     		     	     
			     		     	     var childs = nodeView.children();
			     		     	     for (var n in childs) {	
			     		     	     	     childs[n].show();
			     		     	     	     var grandchildren = childs[n].children();
			     		     	     	     for (var i in grandchildren) grandchildren[i].hide(true);
			     		     	     	     childs[n].redrawControls();
			     		     	     }
			     		     	     
			     		     	     nv = nodeView;
			     		     	     while (true) {
			     		     	     	     nv.redrawControls();
			     		     	     	     if (nv == nv.treeView.rootNodeView) break;
			     		     	     	     var siblings = nv.siblings();
			     		     	     	     for (var n in siblings) {
			     		     	     	     	     siblings[n].hide(true);
			     		     	     	     }			     		     	     	     
			     		     	     	     nv = nv.parent();
			     		     	     	     
			     		     	     }
			     		     	     
			     		     	     
			     		     	     
			     		     }
			     	    }),*/
			     'more' : new nodeViewControl( {
			     		     pos: CONTROL_POS_OUTSIDE,
			     		     css: 'tv_control_out_text',
			     		     isVisible: function(nodeView) {
			     		     	     var children = nodeView.children();
			     		     	     for (n in children) { if (children[n].hidden) return true; }
			     		     	     
			     		     	     return false;
			     		     },
			     		     onClick: function(nodeView) {
			     		     	     nodeView.expand();
			     		     	     var children = nodeView.children();
			     		     	     for (n in children) { 
			     		     	     	if (!children[n].hidden) continue;
			     		     	     	children[n].show(); 
			     		     	     	//childs = children[n].children();			     		     	     	
			     		     	     	children[n].redrawControls();
			     		     	     }			     		     	     
			     		     	     nodeView.redrawControls();
			     		     },
			     		     text: function (nv) {
			     		     	 var hid = 0, shown = 0;
			     		     	 var chil = nv.children();
			     		     	 for (n in chil) { if (chil[n].hidden) hid++; else shown++;}			     		     	 
			     		     	 return '+ ' + hid;
			     		     	 
			     		     },
                                             tooltip: function(nv) {
                                                 var hid = 0, shown = 0;
			     		     	 var chil = nv.children();
			     		     	 for (n in chil) { if (chil[n].hidden) hid++; else shown++;}
                                                 
                                                 if (shown>0) ret = '+ '+hid+' more response';
			     		     	 else ret = '+ '+hid+' response';
			     		     	 if (hid > 1) ret += 's';
			     		     	 return ret;
                                             }
			     	    		    
			     	    })
		},		
		events : new treeViewSettingsEvents,
		multiselect : true,
		multiParentStyle : TREEVIEW_MULTIPARENTSTYLE_STANDARD,
		mappingFunction : function() {
			var lastId = 0;
			this.getMapping = function(node) {
				return { 
					id : lastId++,
					text : node.value
				}
			}
		},
		style : '',
		autoInsert : true
	}
	if (params==undefined) params = {};
	for (setting in defaults) {
		this[setting] = params[setting] == undefined ? defaults[setting] : params[setting];
	}

        this.addControl = function(name, control) {
            this.controls[name]=control;
        }
	
}
