var self = require("sdk/self");
var data = self.data;
var ui = require("sdk/ui");


var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");

var button = buttons.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: toolbarButtonClick
});

var sidebar = ui.Sidebar({
  id: 'my-sidebar',
  title: 'My sidebar',
  url: data.url("ui/index.html")
});

var sidebarShown = false;
function toolbarButtonClick(state) {
  // tabs.open("http://www.mozilla.org/");
  if (sidebarShown) {
  	sidebar.hide();	
  } else {
  	sidebar.show();	
  }
}

sidebar.on("show", function() {
  sidebarShown = true;
  // sidebar.port.emit("show");
});
sidebar.on("hide", function() {
  sidebarShown = false;
  // sidebar.port.emit("hide");
});
