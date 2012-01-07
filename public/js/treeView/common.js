// treeView
// multiparent tree view library
// j.volkmar
// 2010

// dependencies (in order): 
// external : funChain.js, jQuery
// common.js (this)
// node.js
// nodeView.js
// treeSettings.js
// tree.js
// nodeViewControl.js
// treeViewSettingsEvents.js
// treeViewSettings.js
// treeView.js


// steps to using a treeView:
// - declare a jquery object to be your area (normally a <div/>)
// - make treeSettings : new treeSettings(params)
//   ** or omit treeSettings in next step and use defaults
// - make a tree : new tree(treeSettings)	
// - make treeView settings : new treeViewSettings( ? ) , and set them 
//   ** or omit settings in next step and use defaults
// - new treeView(tree, area, settings)
// - make a node tree.createNode(value)
// - tree.setRoot(node);
// - from there, continue using createNode, and the node.append or prepend methods
//   ** or it may be possible to use the node constructor... not sure yet 
//	-- am thinking avoid using constructors: it is illogical to have a node
//	   w/o a tree
// should probably never use createNodeView, that will be internal only

// potential considerations:
// - multi-reply : when selected nodeViews have same nodeID
// - can a node be appended to itself?
// - node as single item vs node as item w/ all children
//      (may be more useful in chat context to take singleton approach)
//      maybe: treat nodes recursively, but nodeViews sinlgy
// - handling of deleting root node.. options: disallow, have beforeDeleteRoot event, allow 
//      (setting tree.root to null)* *=currently implemented
// - mem usage for js objects. eg. when deleting nodes (maybe make sure to set refs to null?)

// exceptions
//var notImplementedError =  new Error("not implemented");
var treeViewError = new Error("treeView error");

function MRCA(node1, node2) {
	//most recent common ancestor, assume single parents only
	if (node1 == node2) return node1;
	if (node1.depth == 0 && node2.depth == 0) return null;
	if (node1.depth > node2.depth) return MRCA(node1.parents[0], node2);
	else if (node1.depth < node2.depth) return MRCA(node1, node2.parents[0]);
	else return MRCA(node1.parents[0], node2.parents[0]);
}

function encapsulate(nodeViewList) { //assume single parent nodes only
	//option one : go through parents, for each one hide child that doesn't have any nodeView in list as ancestor
	                                                  
	//can hide all siblings of most common ancestor, and throughout its parent line
	
	//if there are only 2:
	//find mrca
	//make list of parents up til mrca (can even sort by depth)
	//know what to do for siblings/ancestors of mrca
	//descendants: hide each descendant of mrca that does not appear in one of parent lists (splicing from lists on the go)
	// revision: hide all siblings of parent lines of both nodes up til MRCA
	
	//break up into groups of two?
	
	//more than 2:
	//find mrca for each possible couple
	//take best mrca match, do descendant thing
	//repeat with mrca and rest of list until get to last mrca
	//do descendant thing with last mrca
	
	var usedMrcas = []; //will ignore these when hiding children
	
	var encapHelper = function (nodeViewList) {
		var bestMrca = null;
		var descendants = [];
		for (var j = 0; j<nodeViewList.length-1;j++) {
			for (var k=j+1; k<nodeViewList.length; k++) {
				var mrca = MRCA(nodeViewList[j].node, nodeViewList[k].node);
				if (mrca == null) continue;
				if (bestMrca == null || mrca.depth > bestMrca.depth) {
					bestMrca = mrca;
					descendants = [];
					descendants.push(nodeViewList[j]);
					descendants.push(nodeViewList[k]);
				}
				else if (bestMrca == mrca) {
					if (descendants.indexOf(nodeViewList[j]) == -1)
						descendants.push(nodeViewList[j]);
					if (descendants.indexOf(nodeViewList[k]) == -1)
						descendants.push(nodeViewList[k]);
				}
			}
		}
		if (bestMrca != null) {
			
			//hide children of 'descendants'                                               
			//UNLESS child is a usedMrca, or another descendant descends from the child						         
			for (var n in descendants) {      
				var desc = descendants[n];
				if (usedMrcas.indexOf(desc)!=-1) continue;
				var isDescParent = false;                                                 
				for (var i in descendants) {   
					if (i==n) continue; 
					if (descendants[i].node.depth < desc.node.depth) continue;
					var currDescNode =  descendants[i].node;
					while (currDescNode.depth > desc.node.depth) {
						currDescNode = currDescNode.parents[0];
					}                                          
					if (currDescNode==desc.node) {
						isDescParent = true;
						break;
					}
				}
				if (isDescParent) continue;
				
				children = desc.children();
				for (var c in children) children[c].hide(true); 
				desc.redrawControls();
				
			}
			                                                
			bestMrcaView = null;
			for (var n in bestMrca.nodeViews) {
				if (bestMrca.nodeViews[n].treeView == descendants[0].treeView) {
					bestMrcaView = bestMrca.nodeViews[n];
					break;
				}
			}
			if (bestMrcaView == null) throw Error("nodeViews not in same treeView?");
			                                    
			//hide siblings from parent lines
			var hideSibs = function(nv,exceptList) {          
				if (exceptList == undefined) exceptList = [];
				
				var sibs = nv.siblings();
				for (var n in sibs) {
					var skip =false;
					for (var i in exceptList) {
						if (exceptList[i].id ==sibs[n].id) { skip = true; break; }
					}
					if (skip) continue;
					sibs[n].hide(true);
				}
			}
			var allEqual = function(list, single) { //true if every item in list = single
				for (var n in list)
					if (list[n] != single) return false;
				return true;
			}
			var selectMaxDepthIndex = function(nodeViewList) {
				var maxDepth = 0;
				var maxIndex;
				for (var i = 0; i < nodeViewList.length; i++) {
					if (nodeViewList[i].node.depth > maxDepth) {
						maxIndex = i;
						maxDepth=nodeViewList[i].node.depth;
					}
				}
				return maxIndex;
			}
			descDupList = new Array(descendants.length);
			for (var n in descendants) descDupList[n] = descendants[n];
			while (!allEqual(descDupList,bestMrcaView)) {
				//select max depth from descendants (duplicate)
				maxIndex = selectMaxDepthIndex(descDupList);
				hideSibs(descDupList[maxIndex], descDupList);
				
				//fix for when those in descDupList are siblings:
				var sibs = descDupList[maxIndex].siblings();
				for (var n in descDupList) {
					if (n==maxIndex) continue;
					if (sibs.indexOf(descDupList[n]) != -1) 
						descDupList[n] = descDupList[n].parent();
				}
				                              
				descDupList[maxIndex] = descDupList[maxIndex].parent();				
				descDupList[maxIndex].redrawControls();
			}
			
		}
		else throw Error("no mrca found");
		
		//revise nodeViewList : remove old nodeViews, insert Mrca
		for (var n in descendants) 
			nodeViewList.splice(nodeViewList.indexOf(descendants[n]),1);	
		//nodeViewList.splice(nodeViewList.indexOf(nodeView1),1);
		//nodeViewList.splice(nodeViewList.indexOf(nodeView2),1);
		nodeViewList.push(bestMrcaView);
		usedMrcas.push(bestMrcaView);
		//alert(usedMrcas.length;
		      
		
		   
		if (nodeViewList.length > 1 ) encapHelper(nodeViewList);
		else {			
			while (true) {
				var sibs = bestMrcaView.siblings();    
				for (var n in sibs) sibs[n].hide(true);    
				bestMrcaView = bestMrcaView.parent(); 
				if (bestMrcaView == undefined) break;
				bestMrcaView.redrawControls();
			}                                                     
			
		}
	}
	
	//duplicate the list passed in arguments
	var nvList = Array(nodeViewList.length);
	for (var n in nodeViewList) nvList[n] = nodeViewList[n];
	
	encapHelper(nvList);
	              
	//
}                            

var encap = function(nodeView) {
     //show only parents and children
     
     var childs = nodeView.children();
     //hide grandchildren
     for (var n in childs) {	
	     childs[n].show();           
	     var grandchildren = childs[n].children();
	     for (var i in grandchildren) grandchildren[i].hide(true);
	     childs[n].redrawControls();     
     }                 
                                                       
     nv = nodeView; 
     
     //hide siblings
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

var showAll = function (nodeView) {
	nodeView.show();
	nodeView.expand();
	var c = nodeView.children();
	for (var n = 0; n<c.length; n++) {
		showAll(c[n]);
	}
	nodeView.redrawControls();
}

var showAllTv = function (treeView) {
	
	showAll(treeView.rootNodeView);
}
