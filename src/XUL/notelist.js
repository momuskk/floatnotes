Components.utils.import("resource://floatnotes/database.jsm");
Components.utils.import("resource://floatnotes/manager.jsm");
Components.utils.import("resource://floatnotes/preferences.jsm");

var textBox = document.getElementById('text');
var colorPicker = document.getElementById('color');
var inputBrdcast = document.getElementById('isEnabled');
var deleteButton = document.getElementById('delete');
var searchBox = document.getElementById('search');
var searchList = document.getElementById('searches');
var tree = document.getElementById('notes');

var observer = {
    doObserve: true,
    registerObserver: function() {
        var obsService = Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService);
        obsService.addObserver(this, 'floatnotes-note-update', false);
        obsService.addObserver(this, 'floatnotes-note-delete', false);
        obsService.addObserver(this, 'floatnotes-note-urlchange', false);
        obsService.addObserver(this, 'floatnotes-note-add', false);
        var that = this;
        function remove() {
            that.removeObserver();
        }
        window.addEventListener('unload',remove , true);
        this._removeUnloadListener = function() { window.removeEventListener('unload', remove, true);};
    },

    removeObserver: function() {
        this._removeUnloadListener();
        var obsService = Components.classes["@mozilla.org/observer-service;1"]
                        .getService(Components.interfaces.nsIObserverService);
        obsService.removeObserver(this, 'floatnotes-note-update');
        obsService.removeObserver(this, 'floatnotes-note-delete');
        obsService.removeObserver(this, 'floatnotes-note-urlchange');
        obsService.removeObserver(this, 'floatnotes-note-add');
    },

    observe: function(subject, topic, data) {
        if(this.doObserve) {
            var selection = treeView.selection;
            search();
            if(selection && selection.count === 1) {
                selection.select(selection.currentIndex);
            }
        }
    }
}



var dragHandler = {
    dragStart: function dragStart(event) {
        var index = searchList.getIndexOfItem(event.target);
        if(index > 0) { 
            event.dataTransfer.setData('text/plain', index);
        }
        event.stopPropagation();
    },

    dragOver: function dragOver(event) {
        event.preventDefault();
        event.target.style.borderBottom = "2px solid black";
    },

    dragLeave: function dragLeave(event) {
        event.preventDefault();
        event.target.style.borderBottom = "";
    },

    onDrop: function onDrop(event) {
        var sourceIndex = parseInt(event.dataTransfer.getData("text/plain"));
        var targetIndex = searchList.getIndexOfItem(event.target);
        var source = searchList.removeItemAt(sourceIndex);
        var target = event.target.nextElementSibling;
        if(target) {
            searchList.insertBefore(source, target);
        }
        else {
            searchList.appendChild(source);
        }
        searchManager.move(sourceIndex, targetIndex);
    }
};

function openEditDiag() {
    var item = searchList.selectedItem;
    if(item && searchList.selectedIndex > 0) {
        window.openDialog("chrome://floatnotes/content/editSearch.xul", "Edit Search", "modal", searchList, searchManager);
    }
}

function deleteSearch() {
    var index = searchList.selectedIndex;
    if(index !== null && index > 0) {
        searchManager.delete(index);
        searchList.removeItemAt(index);
        searchList.selectItem(searchList.getItemAtIndex(index - 1));
    }
}

function loadPage() {
    if(treeView.selection.count == 1) {
        var note = treeView.data[treeView.selection.currentIndex];
        if(note) {
            var url =  note.url;
            if(url.lastIndexOf('*') === url.length - 1) {
                url = url.substr(0, url.length-1);
            }
            url += '#floatnotes-note-' + note.id;
            opener.gBrowser.selectedTab = opener.gBrowser.addTab(url); 
        }
    }
}

function saveSearch() {
    var keywords = searchBox.value;
    if(keywords) {
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]  
        .getService(Components.interfaces.nsIPromptService);  

        var check = {value: false};
        var input = {value: ""};
        var result = true;
        while(!input.value && result) {
            result = prompts.prompt(null, "Save search", "Name:", input, null, check);
        } 
        if(result) {
            searchManager.addSearch(input.value, keywords);
        }
    }
}

function search() {
    var words = document.getElementById('search').value;
    var selectedSearch = searchList.selectedItem;
    if(selectedSearch && selectedSearch.value) {
        words = selectedSearch.value + ' ' + words;
    }
    clear();
    if(words) {
        db.getNotesContaining(words.split(' '),function(notes) {
            treeView.data = notes;
            tree.boxObject.invalidate();
            updateCounter();
            if(document.getElementById('search').value) {
                document.getElementById('saveSearch').style.display = 'inline';
            }
            else {
                document.getElementById('saveSearch').style.display = 'none';
            }
            sort();
        });
    }
    else {
        db.getAllNotes(function(notes) {
            treeView.data = notes;
            tree.view = treeView;
            updateCounter();
            document.getElementById('saveSearch').style.display = 'none';
            sort();
        });
    }
}

function getTitle(text) {
    var index = text.indexOf("\n");
    if (index >= 0) {
        return text.substring(0, index);
    }
    else {
        return text;
    }
}

function updateCounter() {
    document.getElementById('counter').value = treeView.rowCount + ' Notes';
}

function saveNote(value, attr) {
    if(treeView.selection.count == 1) {
        var selection = treeView.selection.currentIndex,
            note = treeView.data[selection];

        if(value != note[attr]) {
            note[attr] = value
            observer.doObserve = false;
            manager.saveNote(note, function(id, guid){
                observer.doObserve=true;
                note.modification_date = manager.notes[guid].modification_date;
                tree.boxObject.invalidateRow(selection);
            });
        }
    }
}

function deleteNote() {
    var selection = treeView.selection;
    if(selection && selection.count >=1) {
        if(selection.count == 1) {
            manager.deleteNote(treeView.data[selection.currentIndex], function() {});
            search();
        }
        else {
            var start = new Object();
            var end = new Object();
            var numRanges = tree.view.selection.getRangeCount();
            var data = treeView.data;
            for (var t = 0; t < numRanges; t++){
                tree.view.selection.getRangeAt(t,start,end);
                for (var v = start.value; v <= end.value; v++){
                    manager.deleteNote(data[v], function() {});
                }
            } 
            search();
        }
    }
}

function clear() {
    if(treeView.selection) {
        treeView.selection.clearSelection();     
    }
    inputBrdcast.setAttribute('disabled', true);
    textBox.value="";
    colorPicker.color = "";
}

function sort(column) {
	var columnName;
	var order = tree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
	//if the column is passed and it's already sorted by that column, reverse sort
	if (column) {
		columnName = column.id;
		if (tree.getAttribute("sortResource") == columnName) {
			order *= -1;
		}
	} else {
		columnName = tree.getAttribute("sortResource");
	}

	function columnSort(a, b) {
		if (prepareForComparison(a[columnName]) > prepareForComparison(b[columnName])) return 1 * order;
		if (prepareForComparison(a[columnName]) < prepareForComparison(b[columnName])) return -1 * order;
		//tie breaker: name ascending is the second level sort
		if (columnName != "url") {
			if (prepareForComparison(a["url"]) > prepareForComparison(b["url"])) return 1;
			if (prepareForComparison(a["url"]) < prepareForComparison(b["url"])) return -1;
		}
		return 0;
	}
	treeView.data = treeView.data.sort(columnSort);
	//setting these will make the sort option persist
	tree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
	tree.setAttribute("sortResource", columnName);
	tree.view = treeView;
	//set the appropriate attributes to show to indicator
	var cols = tree.getElementsByTagName("treecol");
	for (var i = 0; i < cols.length; i++) {
		cols[i].removeAttribute("sortDirection");
	}
	document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
}

//prepares an object for easy comparison against another. for strings, lowercases them
function prepareForComparison(o) {
	if (typeof o == "string") {
		return o.toLowerCase();
	}
	return o;
}


var db = getDatabase();
var manager = getManager();
var pref = Preferences;

var searchManager = {
    searches: [['All notes','']].concat(pref.savedSearches),
    buildList: function() {
        var selectedIndex = (searchList.selectedIndex > 0) ? searchList.selectedIndex : 0;
        this.empty();
        for(var i = 0, l = this.searches.length;i<l;i++) {
            searchList.appendItem(this.searches[i][0], this.searches[i][1]);
        }
        //searchList.selectItem(searchList.getItemAtIndex(selectedIndex));
        searchList.selectedIndex = selectedIndex;
    },
    addSearch: function(name, keywords) {
        this.searches.push([name,keywords]);
        this.save();
        this.buildList();
    },
    empty: function() {
        for(var i = searchList.itemCount -1;i >=0;i--) {
            searchList.removeItemAt(i);
        }
    },
    move: function(which, to) {
        var removed = this.searches.splice(which, 1);
        this.searches.splice(to + 1, 0, removed[0]);
        this.save();
    },
    delete: function(index) {
        this.searches.splice(index, 1);
        this.save();
    },
    save: function() {
        pref.savedSearches = this.searches.slice(1);
    },
    update: function(index, name, keywords) {
        this.searches[index] = [name, keywords];
        this.save();
        this.buildList();
    },
    updateButtons: function() {
        document.getElementById('searchListButtons').setAttribute('disabled', (searchList.selectedIndex === 0));
    }
};
var treeView = {
    data: [],
    get rowCount() {
        return this.data.length;
    },  
    getCellText : function(row,column){ 
        if (column.id == "content") return getTitle(this.data[row].content);  
        if (column.id == "url") return this.data[row].url;
        if (column.id == "modification_date") return this.data[row].modification_date.toLocaleString();
        if (column.id == "creation_date") return this.data[row].creation_date.toLocaleString();
    },  
    setTree: function(treebox){ this.treebox = treebox; },  
    isContainer: function(row){ return false; },  
    isSeparator: function(row){ return false; },  
    isSorted: function(){ return false; },  
    getLevel: function(row){ return 0; },  
    getImageSrc: function(row,col){ return null; },  
    getRowProperties: function(row,props){},  
    getCellProperties: function(row,col,props){},  
    getColumnProperties: function(colid,col,props){},
    selectionChanged: function() {
        var count = this.selection.count;
        if(count === 0) {
            inputBrdcast.setAttribute('disabled', true);
            textBox.value = "";
            colorPicker.value = "";
        }
        else if(count == 1) {
            inputBrdcast.setAttribute('disabled', false);
            textBox.disabled = false;
            textBox.value = this.data[this.selection.currentIndex].content;
            colorPicker.color = this.data[this.selection.currentIndex].color;
        }
        else {
            textBox.value = "";
            colorPicker.color = "";
            inputBrdcast.setAttribute('disabled', true);
            deleteButton.disabled = false;
        }
    },

    cycleHeader: function(col) {

    }
};

searchManager.buildList();
observer.registerObserver();