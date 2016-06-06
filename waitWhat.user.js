// ==UserScript==
// @name        waitWhat
// @namespace   waitWhat
// @include     https://cloud.appspotr.com/*
// @version     1
// @grant       none
// @require     react-15.1.0.min.js
// @require     react-dom-15.1.0.min.js
// @require     lodash.min.js
// @require     css-selector-generator.js 
// ==/UserScript==

// TODO:
// Prettify overview list. Show CSS transition info, added/removed etc

// Restore console.log
delete console.log;

console.log('asdf');

// ----------------------------------------------------------------------------
// 'Observations' data structure

function Observations() {
  this.observations = [];
};

// Add a new observation for a node
Observations.prototype.add = function add(observation) {
  this.observations.push(observation);
}
Observations.prototype.addAttribute = function (target, attributeName, oldValue, value) {
    var observation = {
      target: target,
      selector: getSelector(target),
      type: 'attributes',
      attributeName: attributeName,
      oldValue: oldValue,
      value: value
    };
    this.add(observation);
}
// Observations.prototype.addCharacterData = function (target, attributeName, oldValue, value) {
//     var observation = {
//       type: 'characterData',
//       attributeName: attributeName,
//       oldValue: oldValue,
//       value: value
//     };
//     this.add(target, observation);
// }
Observations.prototype.addChildList = function (target, type, nodes) {
    var observation = {
      target: target,
      selector: getSelector(target),
      type: 'childList',
      childListType: type,
      nodes: nodes
    };
    this.add(observation);
}


// ----------------------------------------------------------------------------
// WaitWhat class


// ----------------------------------------------------------------------------
// UI

function startWaitWhat() {
  var HelloMessage = React.createClass({displayName: "HelloMessage",
    getInitialState: function() {
      return {
        listening: false,
        observer:  null,
        observations:  null,
        filters: {
          childList: true,
          attributes: true,
          showCssTransitions: false
        }
      }
    },

    render: function() {
      var style = {
        position: 'absolute',
        top: '20px',
        left: '20px',
        'zIndex': 9000000,
        background: 'white',
        maxHeight: '100%',
        overflow: 'scroll'
      }

      if (this.state.listening) {
        var startStopButton = (React.createElement("button", {onClick: this.stopListening}, "Stop listening"));
      } else {
        var startStopButton = (React.createElement("button", {onClick: this.startListening}, "Start listening"));
      }

      var filterDiv = (
        React.createElement("div", null, 
          React.createElement("label", null, React.createElement("input", {type: "checkbox", checked: this.state.filters.childList, onChange: this.checkboxChanged.bind(this, 'childList')}), " childList (Add/remove from DOM)", React.createElement("br", null)), React.createElement("br", null), 
          React.createElement("label", null, React.createElement("input", {type: "checkbox", checked: this.state.filters.attributes, onChange: this.checkboxChanged.bind(this, 'attributes')}), " attributes ", React.createElement("br", null)), React.createElement("br", null), 
          React.createElement("label", null, React.createElement("input", {type: "checkbox", checked: this.state.filters.showCssTransitions, onChange: this.checkboxChanged.bind(this, 'showCssTransitions')}), " Show CSS transitions ", React.createElement("br", null))
        )
      )

      var listUl = this.renderList();

      var ui = (
        React.createElement("div", null, 
          "Hello!", React.createElement("br", null), 
          startStopButton, 
          React.createElement("hr", null), 
          filterDiv, 
          React.createElement("hr", null), 
          listUl, 
          React.createElement("br", null)
        )
      )

      if (this.state.expanded) {
        var expandContract = React.createElement("button", {onClick: this.contract}, "-")
      } else {
        var expandContract = React.createElement("button", {onClick: this.expand}, "+")
      }
      
      
      return (
        React.createElement("div", {style: style}, 
          expandContract, 
           this.state.expanded ? ui : ""
        )
      );
    },

    expand: function () {
      this.setState({expanded: true});
    },
    contract: function () {
      this.setState({expanded: false});
    },


    checkboxChanged: function (checkboxName, ev) {
      this.state.filters[checkboxName] = ev.target.checked;
      this.setState({filters: this.state.filters})
    },

    renderList: function () {
      if (this.state.observations) {

        // Filter which items should be shown
        var observations = this.state.observations.observations.map(function(observation,key) {
          observation.observationsIndex = key;
          return observation;
        });
        if (!this.state.filters['attributes']) {
          observations = _.reject(observations, {type: 'attributes'});
        }
        if (!this.state.filters['childList']) {
          observations = _.reject(observations, {type: 'childList'});
        }
        if (!this.state.filters['showCssTransitions']) {
          observations = _.reject(observations, isCssTransition);
        }

        // Generate <li>s for each
        var listLis = observations.map((x) => {
          var summary = x.selector + ', ' + x.type;
          var details = this.renderListDetails(x);
          var detailsToggle = x.expanded ? "-" : "+";
          var key = x.observationsIndex;
          return (
            React.createElement("li", {key: key, 
                onClick: this.listClicked.bind(this,key), 
                onMouseEnter: this.listHovered.bind(this,key,true), 
                onMouseLeave: this.listHovered.bind(this,key,false)
                }, 
              detailsToggle, " ", summary, " ", details
            )
          );
        });
        return React.createElement("ul", null, listLis);
      }
      else {
        return "";
      }

    },

    renderListDetails: function(mutation) {
      if (!mutation.expanded) {
        return "";
      }
      var renderers = {
        "childList": this.renderListDetailsChildList,
        "attributes": this.renderListDetailsAttributes
      }
      var renderer = renderers[mutation.type] || _.constant("")
      var lis = renderer.call(this, mutation);
      return (
        React.createElement("ul", null, lis)  
      );
    },

    renderListDetailsChildList: function (mutation) {
      var lis = [];
      var info = mutation.childListType + " these elements:";
      var li = React.createElement("li", null, info);
      lis.push(li);
      for (var node of mutation.nodes) {
        lis.push(React.createElement("li", null, explainNode(node)));
      }
      return lis;

      // Prints an added/removed node in a human-readable way
      function explainNode(node) {
        if (node.nodeName === '#text') {
          return '[text node] '+node.textContent;
        }
        var tagName = node.tagName.toLowerCase();
        var id = node.id ? ` id='${node.id}'` : "";
        var className = node.className ? ` class='${node.className}'` : "";
        var content=node.textContent;

        return `<${tagName}${id}${className}>... ${content} ...</${tagName}>`;
      }
    },
    renderListDetailsAttributes: function (mutation) {
      var lis = [
        React.createElement("li", null, "Old value: ", mutation.oldValue),
        React.createElement("li", null, "New value: ", mutation.value)
      ];
      return lis;
    },


    listClicked: function (key) {
      var obs = this.state.observations.observations[key];
      obs.expanded = !obs.expanded;
      this.setState({observations: this.state.observations});
    },

    listHovered: function(key, hovered) {
      var obs = this.state.observations.observations[key];
      // Maybe want to keep track of this later
      // obs.hovered = hovered;
      // this.setState({observations: this.state.observations});

      // Highlight items on hover
      if (hovered) {
        obs.target.style.border = "5px solid red";
        obs.target.style.backgroundColor = "blue";
        var ignoreElStyle = { // Remember exact style changes
          'border': obs.target.style.border,
          'background-color': obs.target.style.backgroundColor
        }
        this.setState({
          ignoreElStyle: ignoreElStyle
        });
        // This node is special
        obs.target.ignoreMyChange = true; 
        // If this node was de-hovered and hovered again, keep it as special
        obs.target.resetIgnoreMyChange = false; 
      }
      // Un-highlight items on de-hover
      else {
        obs.target.style.border = null;
        obs.target.style.backgroundColor = null;
        obs.target.resetIgnoreMyChange = true;
        setTimeout(() => {
          // Element wasn't re-hovered? Reset it
          if (obs.target.resetIgnoreMyChange) {
            obs.target.ignoreMyChange = false;
          }
        }, 1);
      }
    },

    isHoverModification: function (mutation) {
      var target = mutation.target;
      if (target.ignoreMyChange) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style')  {
          if (this.state.ignoreElStyle) {
            // Did we add a special style?
            var styleStr = target.getAttribute('style');
            var styleObj = parseStyle(styleStr);
            var shouldIgnore = _.every(this.state.ignoreElStyle, function (v,k) {
              return styleObj[k] === v;
            });
            if (shouldIgnore) return true;
            
            // Did we remove a special style?
            var styleObj = parseStyle(mutation.oldValue);
            var shouldIgnore = _.some(this.state.ignoreElStyle, function (v,k) {
              return styleObj[k] === v;
            });
            if (shouldIgnore) return true;
          }
        }
      }
      return false;
    },

    startListening: function() {
      console.log('listening');

      var observations = new Observations();
      var observer = new MutationObserver( (mutations) => {
        mutations.forEach( (mutation) => {
            var target = mutation.target;
            var ourUI = this.props.rootEl.contains(target); // Do not include DOM modifications to our UI
            var ourModification = this.isHoverModification(mutation); // Do not include attribute modifications we caused
            if (ourUI || ourModification) {
              return;
            }
            
            switch (mutation.type) {
              case "attributes":
                var attributeName = mutation.attributeName;
                var value = target.getAttribute(mutation.attributeName);
                var oldValue = mutation.oldValue;
                if (value !== oldValue) {
                  this.state.observations.addAttribute(target, attributeName, oldValue, value);
                  this.setState({observations: this.state.observations});
                }
                break;

              case "characterData":
                var oldValue = mutation.oldValue;
                console.log('characterData changed!!!!!!!!!!', target, oldValue);
                break;

              case "childList":
                var removed = mutation.removedNodes;
                var added = mutation.addedNodes;
                if (added.length) {
                  var nodes = added;
                  var type = 'added';
                } else {
                  var nodes = removed;
                  var type = 'removed';
                }
                this.state.observations.addChildList(target, type, nodes);
                this.setState({observations: this.state.observations});
                break;
            }
        })
      });

      // Attach listener to root node and listen for everything
      var rootNode = document.documentElement;
      var opts = {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true,
        attributeOldValue: true, //maybe not needed
        characterDataOldValue: true //maybe not needed
      }
      observer.observe(rootNode, opts);

      this.setState({
        listening: true,
        observations: observations,
        observer: observer
      });
    },
    stopListening: function() {
      console.log('stop listening');
      console.log(this.state.observations.observations);
      this.state.observer.disconnect();
      this.setState({listening: false});
    }

  });

  var newDiv = document.createElement("div");
  document.body.appendChild(newDiv);
  ReactDOM.render(React.createElement(HelloMessage, {rootEl: newDiv}), newDiv);
}


// ----------------------------------------------------------------------------
// Utils

function getSelector(node) {
  my_selector_generator = new CssSelectorGenerator;
  return my_selector_generator.getSelector(node);
}

function getScript(src, callback) {
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onreadystatechange = s.onload = function() {
    if (!callback.done && (!s.readyState || /loaded|complete/.test(s.readyState))) {
      callback.done = true;
      callback();
    }
  };
  document.querySelector('head').appendChild(s);
}


function parseStyle(styleStr) {
  if (!styleStr) return {};
  styleStr = styleStr.trim()
  var props = styleStr.split(';');
  props = props.filter(_.identity);
  props = props.map(function (prop) {
    return prop.split(':');
  });
  var styleObj = {};
  for (var propKey in props) {
    var prop = props[propKey];
    styleObj[prop[0].trim()] = prop[1].trim();
  }
  return styleObj;
}

/**
 * Checks whether the supplied observation is of a CSS transition
 * (E.g. "opacity: 0" to "opacity: 0.02")
 *
 * @returns {Boolean}
 */
function isCssTransition(observation) {
  if (observation.type !== 'attributes' || observation.attributeName !== 'style')
    return false;
  var style = parseStyle(observation.value);
  var oldStyle = parseStyle(observation.oldValue);

  // Both style objects should have exactly the same keys (e.g. 'opacity')
  var styleKeys = Object.keys(style);
  var oldStyleKeys = Object.keys(oldStyle);
  var changedKeys = _.xor(styleKeys, oldStyleKeys)
  if (changedKeys.length === 0) {
    // The style should have exactly one property with a changed value (e.g. '0.27'/'0.29')
    var changedKeys = _.xorWith(styleKeys, oldStyleKeys, function (styleKey, oldStyleKey) {
      return style[styleKey] === oldStyle[oldStyleKey];
    });
    changedKeys = _.uniq(changedKeys);
    if (changedKeys.length === 1) {
      var key = changedKeys[0];
      // Both old and new values should be numbers
      return _.isFinite(Number(style[key])) && _.isFinite(Number(oldStyle[key]));
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// Script


// getScript('https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.13.1/lodash.min.js', function() {
//   getScript('https://cdn.rawgit.com/fczbkk/css-selector-generator/2c7bfbe622a3411c45412062e46e5214338fb75d/build/css-selector-generator.min.js', function () {
//     getScript('https://fb.me/react-15.1.0.js', function () {
//       getScript('https://fb.me/react-dom-15.1.0.js', function () {
//     // getScript('https://fb.me/react-15.1.0.min.js', function () {
//     //   getScript('https://fb.me/react-dom-15.1.0.min.js', function () {
//         console.log("START")
//         startWaitWhat();
//       })
//     })
//   })
// })

startWaitWhat();
// console.log(waitWhat)

