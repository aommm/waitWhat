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

// "Generate code for checked items", filter out only the visible ones first

// Restore console.log
delete console.log;
window.addEventListener('load', function () {
  console.log("hej")
  startWaitWhat();
});

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

Observations.prototype.addEvent = function (target, name, event) {
  var badEvents = ['mouseout', 'mouseover', 'mousemove']
  if (badEvents.indexOf(name) !== -1) {
    return;
  }
  console.log('ev:', event)
  var observation = {
    target: target,
    selector: getSelector(target),
    type: 'event',
    eventName: name,
    event: event
  };
  this.add(observation);
}



// ----------------------------------------------------------------------------
// WaitWhat class
// The magic code

// Has to be here
var oldAddEventListener = EventTarget.prototype.addEventListener;
var nEvents = 0;
var globalEventHandler = function () {}; // Will be overriden by interested parties
EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
  oldAddEventListener.call(this, eventName, function(event) {
    // console.log('event happened', eventName, this, (nEvents++));
    globalEventHandler(this, eventName, event);
    eventHandler(event);
  });
};


// ----------------------------------------------------------------------------
// UI

function startWaitWhat() {

  var MainView = React.createClass({
    getInitialState: function () {
      return {
        observer:  null,
        observations:  null,
        expanded: false,
        listening: false,
        filters: {
          childList: true,
          attributes: true,
          showCssTransitions: false,
          hideEvents: true,
          hideEventsList: ['mousedown','mouseup','keypress','keydown','keyup'],
          hideAttributes: false,
          hideAttributesList: ['style','class']
        },
        view: 'listView'
      }
    },
    render: function () {
      console.log('rendering MainView');
      var style = {
        position: 'absolute',
        top: '20px',
        left: '20px',
        'zIndex': 9000000,
        background: 'white',
        maxHeight: '100%',
        maxWidth: '80%',
        overflow: 'scroll'
      }
      if (this.state.expanded) {
        var expandContract = <button onClick={this.contract}>-</button>
        var content = this.renderMain();
      } else {
        var expandContract = <button onClick={this.expand}>+</button>
        var content = "";
      }
      return (
        <div style={style}>
          { expandContract }
          { content }
        </div>
      )
    },
    renderMain: function () {
      // body...
      var renderers = {
        "listView": this.renderListView,
        "codeGeneration": this.renderCodeGeneration
      }
      return renderers[this.state.view].call(this);
    },
    renderListView: function () {
      return (
        <ListView
            observer={this.state.observer}
            observations={this.state.observations}
            visibleObservations={this.visibleObservations()}
            filters={this.state.filters}
            listening={this.state.listening}
            setObservations={this.setObservations.bind(this)}
            setObserver={this.setObserver.bind(this)}
            setListening={this.setListening.bind(this)}
            setFilters={this.setFilters.bind(this)}
            next={this.showCodeGeneration.bind(this)}
            rootEl={this.props.rootEl}
            /> /* */
      );
    },
    renderCodeGeneration: function () {

      return (
        <CodeGeneration
          chosenObservations={this.checkedObservations()}
          back={this.showListView.bind(this)}
          /> /* */
      )
    },
    expand: function () {
      this.setState({expanded: true});
    },
    contract: function () {
      this.setState({expanded: false});
    },
    setObservations: function (observations) {
      this.setState({observations: observations});
    },
    setObserver: function (observer) {
      this.setState({observer: observer});
    },
    setListening: function (listening) {
      this.setState({listening: listening});
    },
    setFilters: function (filters) {
      this.setState({filters: filters});
    },
    showListView: function () {
      this.setState({view: 'listView'});
    },
    showCodeGeneration: function () {
      this.setState({view: 'codeGeneration'});
    },

    // Filters the current observations based on user's chosen filters
    // @returns {Observation[]}
    visibleObservations: function() {
      if (!this.state.observations) {
        return [];
      }
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
      if (this.state.filters['hideEvents']) {
        observations = _.reject(observations, (observation) => {
          var eventsToHide = this.state.filters['hideEventsList'];
          if (observation.type == 'event' && eventsToHide) {
            return eventsToHide.includes(observation.eventName);
          }
        }); 
      }
      if (this.state.filters['hideAttributes']) {
        observations = _.reject(observations, (observation) => {
          var attribsToHide = this.state.filters['hideAttributesList'];
          if (observation.type == 'attributes' && attribsToHide) {
            return attribsToHide.includes(observation.attributeName);
          }
        }); 
      }
      return observations;
    },

    // Returns all observations which are both visible and checked by the user
    checkedObservations: function () {
      var observations = this.visibleObservations();
      console.log('observations:', observations);
      observations = _.filter(observations, {checked: true});
      console.log('observations:', observations);
      return observations;
    }


  });

  var ListView = React.createClass({
    getInitialState: function() {
      return {}
    },

    render: function() {

      if (this.props.listening) {
        var startStopButton = (<button onClick={this.stopListening}>Stop listening</button>);
      } else {
        var startStopButton = (<button onClick={this.startListening}>Start listening</button>);
      }

      if (this.props.filters.hideEventsList) {
        var hideEventsStr = this.props.filters.hideEventsList.join(',');
      } else {
        var hideEventsStr = "";
      }
      if (this.props.filters.hideAttributesList) {
        var hideAttributesStr = this.props.filters.hideAttributesList.join(',');
      } else {
        var hideAttributesStr = "";
      }
      
      var filterDiv = (
        <div>
          <label><input type="checkbox" checked={this.props.filters.childList} onChange={this.checkboxChanged.bind(this, 'childList')} /> childList (Add/remove from DOM)<br/></label>
          <label><input type="checkbox" checked={this.props.filters.attributes} onChange={this.checkboxChanged.bind(this, 'attributes')} /> attributes <br/></label>
          <label><input type="checkbox" checked={this.props.filters.showCssTransitions} onChange={this.checkboxChanged.bind(this, 'showCssTransitions')} /> Show CSS transitions <br/></label>
          <label><input type="checkbox" checked={this.props.filters.hideEvents} onChange={this.checkboxChanged.bind(this, 'hideEvents')} /> Hide these events (separated by comma):<br/></label>
          <input type="text" value={hideEventsStr} size="50" onChange={this.listChanged.bind(this, 'hideEventsList')} /><br/>
          <label><input type="checkbox" checked={this.props.filters.hideAttributes} onChange={this.checkboxChanged.bind(this, 'hideAttributes')} /> Hide these attribs (separated by comma):<br/></label>
          <input type="text" value={hideAttributesStr} size="50" onChange={this.listChanged.bind(this, 'hideAttributesList')} /><br/>
        </div>
      )

      var listUl = this.renderList();
      var nextDisabled = !this.props.observations || !this.props.observations.observations.length;

      var ui = (
        <div>
          Hello!<br/>
          {startStopButton}
          <hr/>
          {filterDiv}
          <hr/>
          {listUl}
          <br/>
          <button onClick={this.next} disabled={nextDisabled}>Generate code</button>
        </div>
      )

      return ui;
    },

    // Go to next screen
    next: function () {
      this.stopListening();
      this.props.next();
    },

    checkboxChanged: function (checkboxName, ev) {
      this.props.filters[checkboxName] = ev.target.checked;
      this.props.setFilters(this.props.filters);
    },

    listChanged: function (listName, ev) {
      // Parse string into list and save
      var list = ev.target.value.split(",");
      list = list.map((item) => {
        return item.trim();
      });
      this.props.filters[listName] = list;
      this.props.setFilters(this.props.filters);
    },

    renderList: function () {
      if (!this.props.visibleObservations) {
        return "";
      }

      // Generate <li>s for each
      var listLis = this.props.visibleObservations.map((x) => {
        var summary = x.selector + ', ' + x.type;
        var details = this.renderListDetails(x);
        var detailsToggle = x.expanded ? "-" : "+";
        var key = x.observationsIndex;
        return (
          <li key={key}
              onMouseEnter={this.listHovered.bind(this,key,true)}
              onMouseLeave={this.listHovered.bind(this,key,false)} >
              <input type="checkbox" checked={x.checked} onChange={this.listCheckboxChanged.bind(this, key)} />
              <span onClick={this.listClicked.bind(this,key)}>
              {detailsToggle} {summary}
              </span>
            {details}
          </li>
        );
      });
      return <ul>{listLis}</ul>;

    },

    renderListDetails: function(mutation) {
      if (!mutation.expanded) {
        return "";
      }
      var renderers = {
        "childList": this.renderListDetailsChildList,
        "attributes": this.renderListDetailsAttributes,
        "event": this.renderListDetailsEvent
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
        <li>Old value: {mutation.attributeName}="{mutation.oldValue}"</li>,
        <li>New value: {mutation.attributeName}="{mutation.value}"</li>
      ];
      return lis;
    },
    renderListDetailsEvent: function (mutation) {
      var lis = [
        <li>Event name: {mutation.eventName}</li>
      ];
      return lis;
    },



    listClicked: function (key) {
      var obs = this.props.observations.observations[key];
      obs.expanded = !obs.expanded;
      this.props.setObservations(this.props.observations);
    },

    listHovered: function(key, hovered) {
      var obs = this.props.observations.observations[key];
      // Maybe want to keep track of this later
      // obs.hovered = hovered;
      // this.props.setObservations(this.props.observations);

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

    listCheckboxChanged: function (key) {
      var observation = this.props.observations.observations[key];
      observation.checked = !observation.checked
      this.props.setObservations(this.props.observations);
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
      this.props.setObservations(observations);
      
      this.startListeningEvents();
      this.startListeningMutations();
      this.props.setListening(true);
    },

    // Start listening for user events
    startListeningEvents: function () {
      console.log('startListeningEvents')

      // TODO why aren't 'event happened' printed before a DOM modification?
      // We're interested in user events!
      // TODO put behind boolean
      // TODO filter out events on our UI
      // TODO add observations
      var self = this;
      globalEventHandler = function (ctx, name, event) {
        // console.log('event happened', arguments);
        // Do not include DOM modifications to our UI
        var target = event.target;
        var ourUI = self.props.rootEl.contains(target); 
        if (ourUI) {
          return;
        }
        self.props.observations.addEvent(target, name, event);
        self.props.setObservations(self.props.observations);
      }
    },

    // Start listening for DOM mutations
    startListeningMutations: function () {
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
                  this.props.observations.addAttribute(target, attributeName, oldValue, value);
                  this.props.setObservations(this.props.observations);
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
                this.props.observations.addChildList(target, type, nodes);
                this.props.setObservations(this.props.observations);
                break;
            }
        });
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

      this.props.setObserver(observer);
    },

    stopListening: function() {
      console.log('stop listening');
      globalEventHandler = function() {}
      console.log(this.props.observations.observations);
      this.props.observer.disconnect();
      this.props.setListening(false);
    }

  });

  var CodeGeneration = React.createClass({

    getInitialState: function () {
      return {
        testFramework: "casperjs"
      }
    },

    testFrameworkChanged: function (ev) {
      this.setState({
        testFramework: ev.target.value
      })
      console.log(arguments);
    },
    
    render: function () {
      var select = (
        <select value={this.state.testFramework} onChange={this.testFrameworkChanged}>
          <option value="casperjs">CasperJS</option>
          <option value="selenium">Selenium</option>
        </select>
      );

      if (!this.props.chosenObservations) {
        var code = "No chosen observations";
      } else {
        if (this.state.testFramework == "casperjs") {
          var cg = new CasperCodeGenerator();
        } else if (this.state.testFramework == "selenium") {
          console.log("TODO implement selenium")
          var cg = new CasperCodeGenerator();
        }
        var code = cg.generateCode(this.props.chosenObservations);
      }

      return (
        <div>
          <button onClick={this.props.back}>Back</button><br/>
          {select}
          <hr/>
          {code}
        </div>
      )
    }

  })

  var newDiv = document.createElement("div");
  document.body.appendChild(newDiv);
  ReactDOM.render(<MainView rootEl={newDiv} />, newDiv);
}


function CasperCodeGenerator() {
  this.reset();
}
CasperCodeGenerator.prototype.reset = function () {
  this.attributeChanged = false;
}

CasperCodeGenerator.prototype.waitForAttributeTemplate = `
// CasperJS helper that waits until 'selector' gets a specific attribute
casper.waitForAttribute = function (selector, attributeName, attributeValue, cb) {
  this.waitFor(function () {
    var value = this.getElementAttribute(selector, attributeName);
    return value === attributeValue;
  }, cb);
}
`;

CasperCodeGenerator.prototype.generateCode = function (observations) {
  var jss = observations.map(this._generateCode.bind(this));
  if (this.attributeChanged) {
    var waitForAttributeTemplate = this.waitForAttributeTemplate.split('\n');
    waitForAttributeTemplate = [...intersperse(waitForAttributeTemplate, <br/>)]
    jss.unshift(waitForAttributeTemplate);
  }
  jss = [...intersperse(jss, <br/>)];
  js = _.flattenDeep(jss);
  console.log(jss);
  console.log(js);

  this.reset();
  return js;
}
CasperCodeGenerator.prototype._generateCode = function (observation) {
  var codeGenerators = {
    'childList': this._childList,
    'attributes': this._attributes
  }
  var js = codeGenerators[observation.type].call(this, observation);
  return [js];
}
CasperCodeGenerator.prototype._childList = function (observation) {
  console.log('observation cl:', observation);
  childSelectors = Array.prototype.slice.call(observation.nodes).map(function (node) {
    return getSelector(node);
  });
  if (observation.childListType === 'added') {
    var js = childSelectors.map(function (childSelector) {
      return `casper.waitForSelector('${childSelector}');`
    });
  } else if (observation.childListType === 'removed') {
    var js = childSelectors.map(function (childSelector) {
      return `casper.waitWhileSelector('${childSelector}');`
    });
  }
  return [...intersperse(js, <br/>)];
}
CasperCodeGenerator.prototype._attributes = function (observation) {
  console.log('observation at:', observation);
  this.attributeChanged = true;
  return `casper.waitForAttribute('${observation.selector}', '${observation.attributeName}', '${observation.value}');`
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
    styleObj[prop[0].trim()] = prop[1] && prop[1].trim();
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

function *intersperse(a, delim) {
  let first = true;
  for (var x of a) {
    if (!first) yield delim;
    first = false;
    yield x;
  }
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

// console.log(waitWhat)

