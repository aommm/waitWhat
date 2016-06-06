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
// Details for all mutations (only attribute newvalue?): store them 
// Fix body selector


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
  var HelloMessage = React.createClass({
    getInitialState: function() {
      return {
        listening: false,
        observer:  null,
        observations:  null,
        filters: {
          childList: true,
          attributes: true
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
        var startStopButton = (<button onClick={this.stopListening}>Stop listening</button>);
      } else {
        var startStopButton = (<button onClick={this.startListening}>Start listening</button>);
      }

      var filterDiv = (
        <div>
          <label><input type="checkbox" checked={this.state.filters.childList} onChange={this.checkboxChanged.bind(this, 'childList')} /> childList (Add/remove from DOM)<br/></label><br/>
          <label><input type="checkbox" checked={this.state.filters.attributes} onChange={this.checkboxChanged.bind(this, 'attributes')} /> attributes <br/></label>
        </div>
      )

      var listUl = this.renderList();

      var ui = (
        <div>
          Hello!<br/>
          {startStopButton}
          <hr/>
          {filterDiv}
          <hr/>
          {listUl}
          <br/>
        </div>
      )

      if (this.state.expanded) {
        var expandContract = <button onClick={this.contract}>-</button>
      } else {
        var expandContract = <button onClick={this.expand}>+</button>
      }
      
      
      return (
        <div style={style}>
          {expandContract}
          { this.state.expanded ? ui : ""}
        </div>
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
        for (var filterName in this.state.filters) {
          if (!this.state.filters[filterName]) {
            observations = _.reject(observations, {type: filterName});
          }
        }

        // Generate <li>s for each
        var listLis = observations.map((x) => {
          var summary = x.selector + ', ' + x.type;
          var details = this.renderListDetails(x);
          var detailsToggle = x.expanded ? "-" : "+";
          var key = x.observationsIndex;
          return (
            <li key={key}
                onClick={this.listClicked.bind(this,key)}
                onMouseEnter={this.listHovered.bind(this,key,true)}
                onMouseLeave={this.listHovered.bind(this,key,false)}
                >
              {detailsToggle} {summary} {details}
            </li>
          );
        });
        return <ul>{listLis}</ul>;
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
        <ul>{lis}</ul>  
      );
    },

    renderListDetailsChildList: function (mutation) {
      var lis = [];
      var info = mutation.childListType + " these elements:";
      var li = <li>{info}</li>;
      lis.push(li);
      for (var node of mutation.nodes) {
        lis.push(<li>{explainNode(node)}</li>);
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
        <li>Old value: {mutation.oldValue}</li>,
        <li>New value: {mutation.value}</li>
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
  ReactDOM.render(<HelloMessage rootEl={newDiv} />, newDiv);
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

