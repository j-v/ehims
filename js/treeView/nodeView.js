var NODEVIEW_STATE_EXPANDED = 0;
var NODEVIEW_STATE_COLLAPSED = 1;

var nodeView = function (node, treeView) {
	var self= this;
	var styleSuffix = treeView.styleSuffix;
    
    this.state = NODEVIEW_STATE_EXPANDED;
	
	if (node == undefined) throw Error("Must specify first argument 'node' for nodeView constructor");
	if (treeView == undefined) throw Error("Must specify second argument 'treeView' for nodeView constructor");
	
	this.node = node;
	node.nodeViews.push(this);
	
	this.selected = false;
	
	this.hidden = false;
	this.treeView = treeView;
	
	this.text = '';
	
	var mappings = this.treeView.mappingFunction.getMapping(node);		
	this.id = mappings.id;		
	for (var m in mappings) this[m] = mappings[m]; //apply mappings
	
	this.siblings = function () { //function to get array of siblings
		var ret = [];
		var parent = this.parent();
		if (parent == undefined) return ret;
		var parentChildren = parent.children();
		for (var n=0; n<parentChildren.length; n++) {
			var child = parentChildren[n];
			if (child != this) ret.push(child);
		}
		return ret;
	}
	
	this.parent = function () { //function to get parent nodeView of this
		// area (up) li (up) ul (up) li (down) div
		return this.area.parent('li').parent('ul').parent('li').children('.tv_node'+styleSuffix).data('nodeView');
	}
	
	this.children = function () { //function to get array of child nodeViews
		var ret = [];		
		childNodeViewDivs = this.area.parent().children('ul').children('li').children('.tv_node'+styleSuffix);
		//for (var n in childNodeViewDivs) {
		for (var n = 0; n < childNodeViewDivs.length; n++) {
			var div = $(childNodeViewDivs[n]);
			ret.push(div.data('nodeView'));
		}
		return ret;
	}
	
	this.select = function (passive) {
		if (passive == undefined) passive = false;
		
		// makes this node the only selected nodeView
		if (this.treeView == null) 
			throw treeViewError; //need a treeView
		
		if (!this.selected) {
			this.selected = true;
			var selection = this.treeView.selection;
			//should be able to remove next line
			if (selection.indexOf(this) != -1) return; //node is already selected somehow
			selection.push (this);
			
			this.area.addClass('tv_node_selected'+this.treeView.styleSuffix);
			
			
			for (var i = 0; i<selection.length; i++)
			{
				var sel = selection[i];
				if (sel == this) continue;
				sel.unselect();
				i--;
			}
			//for (var s in selection)
			//	selection[s].unselect();
			
			if (!passive) doEvent('select');	
		}
	}
	
	this.unselect = function () {
		//unselects the nodeView
		if (this.treeView == null) 
			throw treeViewError; //need a treeView
		
		if (this.selected) {
			this.selected = false;
			var selection = this.treeView.selection;			
			index = selection.indexOf(self);
			//should be able to remove next line
			if (index == -1) return;
			selection.splice(index,1);
			this.area.removeClass('tv_node_selected'+this.treeView.styleSuffix);
			doEvent('unselect');
		}
	}
	
	this.multiselect = function () {
		// adds this node to the treeView's selection
		// if multi select is permitted
		if (this.treeView == null) 
			throw treeViewError; //need a treeView
		
		if (!this.treeView.settings.multiselect)
			throw new Error("treeView does not permit multiselect");
		
		if (!this.selected) {
			this.selected = true;
			var selection = this.treeView.selection;
			//should be able to remove next line
			if (selection.indexOf(this) != -1) return; //node is already selected somehow
			selection.push(this);
			this.area.addClass('tv_node_selected'+this.treeView.styleSuffix);			
			doEvent('select');
		}
		
	}
	
	//removes the view but doesn't delete node 
        // although this is called by node.remove()
	this.remove = function () {
		this.unselect();
		//recursive on children
		var children = this.children();
		for (var i = 0; i<children.length; i++) children[i].remove();
		
		var tv = this.treeView;
		if (tv.rootNodeView==this) tv.rootNodeView=null;
		//delete treeView's reference of this nodeView
		var nvIndex = tv.nodeViews.indexOf(this);
		if (nvIndex != -1) tv.nodeViews.splice(nvIndex,1);
		//delete node's reference of this nodeView
		nvIndex = this.node.nodeViews.indexOf(this);
		if (nvIndex != -1) this.node.nodeViews.splice(nvIndex,1)
		//delete the area
		var pli = this.area.parent();
		var pul = pli.parent();
		if (this.siblings().length == 0) {			
			var pnodeView = this.parent();
			if (pnodeView != undefined) pnodeView.redrawControls();
			
			pul.remove();
		}
		else pli.remove();		
		
		//events?
	}
    
    //rule: collapsed nodeViews children are never 'shown' 
    //i.e. show and hide are not recursive
    this.hide = function(recurse) {
    	    	
    	if (this.hidden) {return;}  
    	if (recurse === undefined) recurse = false;
        this.hidden = true;
        this.redrawControls();
        //this.area.parent('li').hide();
        this.area.parent('li').fadeOut(function(){$(this).css({display:'none'});});
        if (recurse) {
        	var children = this.children();
        	for (var n in children) {
        		children[n].hide(true);
        	}
        }
        
    }
    
    this.show = function() {
        if (!this.hidden) return;
        this.hidden = false;        
        this.redrawControls();
        this.area.parent('li').fadeIn();
    }
	
	this.collapse = function () {
		if (this.state == NODEVIEW_STATE_COLLAPSED) return;
		this.state = NODEVIEW_STATE_COLLAPSED;
		
		childUl = this.area.parent().children('ul');
		if (childUl.length == 0) return;
		else childUl.slideUp(100);
		
	}
	
	this.expand = function () {
		if (this.state == NODEVIEW_STATE_EXPANDED) return;
		this.state = NODEVIEW_STATE_EXPANDED;
		
		childUl = this.area.parent().children('ul');
		if (childUl.length == 0) return;
		else childUl.slideDown(100);
			
	}
	
	var doEvent = function (eventName) {
		var events = self.treeView.settings.events;
		var event = events[eventName];
		if (event != undefined && typeof[event] == 'object')
			event.execute([self]);
	}
	
	//**some helper functions for drawing
	var controlsCode = function() { 
		var ss = self.treeView.styleSuffix;
		var controlsDivL = $('<div class="tv_node_controls'+ss+' tv_node_controls_l'+ss+'"/>');
		var controlsDivR = $('<div class="tv_node_controls'+ss+' tv_node_controls_r'+ss+'"/>');
		var controlsDivOut = $('<div class="tv_node_controls'+ss+' tv_node_controls_out'+ss+'"/>');
		
		var controls = self.treeView.settings.controls;
		for (var name in controls) {
			var ctrl = controls[name];
			var ctrlDiv = $('<div id="'+name+'" class="tv_node_control '+ctrl.css+'"/>');
                        var tooltip = ctrl.tooltip;
                        if (tooltip != undefined) {
                            ctrlDiv.attr('title', tooltip(self));
                        }
			ctrlDiv.click(
				function() {
					controls[$(this).attr('id')].onClick(self);
					self.redrawControls();
				} );
			
			switch (ctrl.pos) {
				case null:
				case CONTROL_POS_LEFT:
					controlsDivL.append(ctrlDiv);
					break;
				case CONTROL_POS_RIGHT:
					controlsDivR.append(ctrlDiv);
					break;
				case CONTROL_POS_OUTSIDE:
					if (ctrl.text !== undefined) {
						ctrlDiv.text(ctrl.text(self));	
					}
					controlsDivOut.append(ctrlDiv);
					break;
				default:
					throw Error("Cannot determine position of nodeViewControl");
					break;
			}
			if (!ctrl.isVisible(self)) ctrlDiv.hide();
		}
		//put spacer on right of left hand controls
		controlsDivL.append($('<div class="tv_control_spacer'+ss+'"></div>'));
		return [controlsDivL,controlsDivR, controlsDivOut];
	}

        this.hasAncestor = function(nodeView) {
            var parent = this.parent();
            if (parent == undefined)
                return false;
            else if (parent == nodeView)
                return true
            else
                return parent.hasAncestor(nodeView);
        }
	
	

	this.area = self.treeView.nodeViewCode(self.node); // jquery object <div/>
        this.area.click( function(e) { //trigger event chain for click or shiftClick
                if (e.shiftKey) {
                        self.treeView.settings.events.shiftClick.execute(self);
                } else {
                        self.treeView.settings.events.click.execute(self);
                }
        });
	this.area.data("nodeView",this);
	
	this.drawChild = function(childNodeView) { 
		//when inserting a nodeView, this is called on the parent nodeView
		
		//check if childNodeView actually corresponds to a real child
		var children = this.node.children;
		var childnode = childNodeView.node;
		var index = children.indexOf(childnode);
		if (index==-1)
			throw Error("specified child node to draw was node found in the node's children!");
		
		var ss = this.treeView.styleSuffix;
		
		
		if (this.area == null) 
			throw Error("Tried to draw a nodeView with a parent that hasn't been drawn to the tree.");
		var pareali = this.area.parent();
		
		//***
		//possibly use recursive helper fn here...

                var childNvs = this.children();
                //check if nodeview is already drawn
                //var drawn = false;
                for (var i=0;i<childNvs.length;i++) {
                    if (childNvs[i].node.id == childnode.id)  {
                          return childNodeView;
//                        drawn = true;
//                        break;
                    }
                }

		//make a ul under parent node if this is its first child
		if (childNvs.length == 0) {
			var insertUl = $('<ul class="tv_ul'+ss+'"/>');
			pareali.append(insertUl); 
		} else {
			var insertUl = pareali.children('.tv_ul'+ss+'');
		}
		
		//... or here				
		var insertLi = $('<li class="tv_li'+ss+'"><div class="tv_connector'+ss+'"></div></li>');				
		
		//have a list item to insert into, now draw a div inside the li
		var childArea = childNodeView.area; 
		if (childArea == null) {
			throw Error ("NodeView to draw's area has not been set. (this should occcur in the nodeView constructor");
		}
			
		//append node div to nodeli
		insertLi.append(childArea);
		insertLi.append('<div class="tv_node_controls_out'+ss+'"></div>');
		insertLi.append('<div style="clear:both"></div>');
		//assume all other nodes preceding this one have been drawn, and use index to insert it at 
		//the right point
		
		
		// NOTE: for now it only appends or prepends, should be enough for our purposes
		//if (index == 0) insertUl.prepend(insertLi)
		//else insertUl.append(insertLi); 
		
		if (index == 0) insertUl.prepend(insertLi)
		else
		{
			//var children = this.children();
			//should suffice to find preceding nv, as they are inserted in order
			
			insertUl.append(insertLi);
		}
	
		childNodeView.redrawControls();
		this.redrawControls();

                return childNodeView;
	
	}
	
	this.drawChildren = function () { //NOT AUTOMATICALLY IN ORDER
		if (this.children().length > 0)
			throw Error("drawChildren() can only be called on nodeViews with no drawn children");

		var children = this.node.children;
		var tv = this.treeView;
		for (var i =0; i<children.length; i++) {
			child = children[i];
			var nv = tv.createNodeView(child);
			this.drawChild(nv);
		}
	}
	
	
	this.drawSiblings = function() { //NOT AUTOMATICALLY IN ORDER
		
		var sibs = this.node.parents[0].children,
		    treeView = this.treeView,
		    parentNv = this.parent();
		for (var i = 0; i<sibs.length; i++) {
			var drawn = false,
			    nvs = sibs[i].nodeViews;			
			for (var j = 0; j< nvs.length; j++) {
				if (nvs[j].treeView == treeView) {
					drawn = true;
					break;
				}
			}
			if (!drawn) {
				var nv = treeView.createNodeView(sibs[i]);
				parentNv.drawChild(nv);
			}
		}
	}
	
	this.redrawControls = function () {
		var ctrlsCode = controlsCode();
		var lctrls = ctrlsCode[0];
		var rctrls = ctrlsCode[1];
		var outctrls = ctrlsCode[2];
                var ss =this.treeView.styleSuffix;
		this.area.children('.tv_node_controls_l'+ss).replaceWith(lctrls);
		var rctrlsdiv = this.area.children('.tv_node_controls_r'+ss);
		rctrlsdiv.replaceWith(rctrls);
		rctrls.hide();		
		this.area.parent().children('.tv_node_controls_out'+ss).replaceWith(outctrls);
		
	}
	
	
    //blinks the node view
	this.blink = function (color, count) {	
		var blinkDown = count,
		    blinkInterval = 500, //(ms)
		    defaultColor ='#fff985';
		    
		if (color == undefined) color = defaultColor;
		if (blinkDown == undefined) blinkDown = 4;
		
		function blinkOn() {
			self.area.css({'background-color':color});
		}
		
		function blinkOff() {
			self.area.css({'background-color':''});
		}
		
		
		function blinkAgain(cb) {
			blinkOff();
			setTimeout(blinkOnce, blinkInterval );
		}
		
		function blinkOnce(cb) {
			blinkOn();
			blinkDown--;
			var next;
			if (blinkDown)
				next = blinkAgain;
			else 
				next = blinkOff;
				
			setTimeout(next, blinkInterval);
		}
		blinkOnce();
	}
	
	this.findChild = function (node) 
	{
		var children = this.children();
		for (var i=0; i<children.length; i++)
		{
			var child = children[i];
			if (child.node == node) return child;
		}
		return null;
	}
}
