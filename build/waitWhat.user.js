"use strict";

var _marked = [intersperse].map(regeneratorRuntime.mark);

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// ==UserScript==
// @name        waitWhat
// @namespace   waitWhat
// @include     https://cloud.appspotr.com/*
// @version     1
// @grant       none
// @require     libs/polyfill.min.js
// @require     libs/react-frame.js
// @require     libs/react-15.1.0.min.js
// @require     libs/react-dom-15.1.0.min.js
// @require     libs/lodash.min.js
// @require     libs/css-selector-generator.js
// ==/UserScript==

// TODO:
// Prettify overview list. Show CSS transition info, added/removed etc

// "Generate code for checked items", filter out only the visible ones first

// Restore console.log
delete console.log;
window.addEventListener('load', function () {
  console.log("hej");
  startWaitWhat();
});

console.log("yo");
console.log("yo");

// ----------------------------------------------------------------------------
// 'Observations' data structure

function Observations() {
  this.observations = [];
};

// Add a new observation for a node
Observations.prototype.add = function add(observation) {
  this.observations.push(observation);
};
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
};
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
};

Observations.prototype.addEvent = function (target, name, event) {
  var badEvents = ['mouseout', 'mouseover', 'mousemove'];
  if (badEvents.indexOf(name) !== -1) {
    return;
  }
  var observation = {
    target: target,
    targetValue: target.value,
    selector: getSelector(target),
    type: 'event',
    eventName: name,
    event: event
  };
  this.add(observation);
};

// ----------------------------------------------------------------------------
// WaitWhat class
// The magic code

// Has to be here
var oldAddEventListener = EventTarget.prototype.addEventListener;
var nEvents = 0;
var globalEventHandler = function globalEventHandler() {}; // Will be overriden by interested parties
EventTarget.prototype.addEventListener = function (eventName, eventHandler) {
  oldAddEventListener.call(this, eventName, function (event) {
    // console.log('event happened', eventName, this, (nEvents++));
    globalEventHandler(this, eventName, event);
    eventHandler(event);
  });
};

// ----------------------------------------------------------------------------
// UI

function startWaitWhat() {

  var MainView = React.createClass({
    displayName: "MainView",

    getInitialState: function getInitialState() {
      return {
        observer: null,
        observations: null,
        expanded: false,
        listening: false,
        filters: {
          childList: true,
          attributes: true,
          mergeInputEvents: true,
          showCssTransitions: false,
          hideEvents: true,
          hideEventsList: ['mousedown', 'mouseup', 'keypress', 'keydown', 'keyup'],
          hideAttributes: false,
          hideAttributesList: ['style', 'class']
        },
        view: 'listView'
      };
    },
    render: function render() {
      console.log('rendering MainView');
      if (this.state.expanded) {
        var expandContract = React.createElement(
          "button",
          { onClick: this.contract },
          "-"
        );
        var content = this.renderMain();
      } else {
        var expandContract = React.createElement(
          "button",
          { onClick: this.expand },
          "+"
        );
        var content = "";
      }
      return React.createElement(
        "div",
        { id: "waitWhat" },
        expandContract,
        content
      );
    },
    renderMain: function renderMain() {
      // body...
      var renderers = {
        "listView": this.renderListView,
        "codeGeneration": this.renderCodeGeneration
      };
      return renderers[this.state.view].call(this);
    },
    renderListView: function renderListView() {
      return React.createElement(ListView, {
        observer: this.state.observer,
        observations: this.state.observations,
        visibleObservations: this.visibleObservations(),
        filters: this.state.filters,
        listening: this.state.listening,
        setObservations: this.setObservations.bind(this),
        setObserver: this.setObserver.bind(this),
        setListening: this.setListening.bind(this),
        setFilters: this.setFilters.bind(this),
        next: this.showCodeGeneration.bind(this),
        rootEl: this.props.rootEl
      }) /* */
      ;
    },
    renderCodeGeneration: function renderCodeGeneration() {

      return React.createElement(CodeGeneration, {
        chosenObservations: this.checkedObservations(),
        back: this.showListView.bind(this)
      }) /* */
      ;
    },
    expand: function expand() {
      this.setState({ expanded: true });
    },
    contract: function contract() {
      this.setState({ expanded: false });
    },
    setObservations: function setObservations(observations) {
      this.setState({ observations: observations });
    },
    setObserver: function setObserver(observer) {
      this.setState({ observer: observer });
    },
    setListening: function setListening(listening) {
      this.setState({ listening: listening });
    },
    setFilters: function setFilters(filters) {
      this.setState({ filters: filters });
    },
    showListView: function showListView() {
      this.setState({ view: 'listView' });
    },
    showCodeGeneration: function showCodeGeneration() {
      this.setState({ view: 'codeGeneration' });
    },

    // Filters the current observations based on user's chosen filters
    // @returns {Observation[]}
    visibleObservations: function visibleObservations() {
      var _this = this;

      if (!this.state.observations) {
        return [];
      }
      // Filter which items should be shown
      var observations = this.state.observations.observations.map(function (observation, key) {
        observation.observationsIndex = key;
        return observation;
      });
      if (!this.state.filters['attributes']) {
        observations = _.reject(observations, { type: 'attributes' });
      }
      if (!this.state.filters['childList']) {
        observations = _.reject(observations, { type: 'childList' });
      }
      if (!this.state.filters['showCssTransitions']) {
        observations = _.reject(observations, isCssTransition);
      }
      if (this.state.filters['hideEvents']) {
        observations = _.reject(observations, function (observation) {
          var eventsToHide = _this.state.filters['hideEventsList'];
          if (observation.type == 'event' && eventsToHide) {
            return eventsToHide.includes(observation.eventName);
          }
        });
      }
      if (this.state.filters['hideAttributes']) {
        observations = _.reject(observations, function (observation) {
          var attribsToHide = _this.state.filters['hideAttributesList'];
          if (observation.type == 'attributes' && attribsToHide) {
            return attribsToHide.includes(observation.attributeName);
          }
        });
      }
      if (this.state.filters['mergeInputEvents']) {
        var latestObservation = null;
        for (var i = observations.length - 1; i >= 0; i--) {
          var observation = observations[i];
          if (observation.type == 'event' && observation.eventName == 'input') {
            // Should remove? (== part of already seen input sequence?)
            if (latestObservation && latestObservation.selector == observation.selector) {
              // console.log('throwing away observation', observation);
              delete observations[i];
            }
            // Didn't remove - start of new input cycle
            else {
                // console.log('keeping observation', observation);
                latestObservation = observation;
              }
          }
        };
        observations = _.filter(observations);
      }
      return observations;
    },

    // Returns all observations which are both visible and checked by the user
    checkedObservations: function checkedObservations() {
      var observations = this.visibleObservations();
      console.log('observations:', observations);
      observations = _.filter(observations, { checked: true });
      console.log('observations:', observations);
      return observations;
    }

  });

  var ListView = React.createClass({
    displayName: "ListView",

    getInitialState: function getInitialState() {
      return {};
    },

    render: function render() {

      if (this.props.listening) {
        var startStopButton = React.createElement(
          "button",
          { onClick: this.stopListening },
          "Stop listening"
        );
      } else {
        var startStopButton = React.createElement(
          "button",
          { onClick: this.startListening },
          "Start listening"
        );
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

      var filterDiv = React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.childList, onChange: this.checkboxChanged.bind(this, 'childList') }),
          " childList (Add/remove from DOM)",
          React.createElement("br", null)
        ),
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.attributes, onChange: this.checkboxChanged.bind(this, 'attributes') }),
          " attributes ",
          React.createElement("br", null)
        ),
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.showCssTransitions, onChange: this.checkboxChanged.bind(this, 'showCssTransitions') }),
          " Show CSS transitions ",
          React.createElement("br", null)
        ),
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.mergeInputEvents, onChange: this.checkboxChanged.bind(this, 'mergeInputEvents') }),
          " Merge input events ",
          React.createElement("br", null)
        ),
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.hideEvents, onChange: this.checkboxChanged.bind(this, 'hideEvents') }),
          " Hide these events (separated by comma):",
          React.createElement("br", null)
        ),
        React.createElement("input", { type: "text", value: hideEventsStr, size: "50", onChange: this.listChanged.bind(this, 'hideEventsList') }),
        React.createElement("br", null),
        React.createElement(
          "label",
          null,
          React.createElement("input", { type: "checkbox", checked: this.props.filters.hideAttributes, onChange: this.checkboxChanged.bind(this, 'hideAttributes') }),
          " Hide these attribs (separated by comma):",
          React.createElement("br", null)
        ),
        React.createElement("input", { type: "text", value: hideAttributesStr, size: "50", onChange: this.listChanged.bind(this, 'hideAttributesList') }),
        React.createElement("br", null)
      );

      var listUl = this.renderList();
      var nextDisabled = !this.props.observations || !this.props.observations.observations.length;

      var ui = React.createElement(
        "div",
        null,
        "Hello!",
        React.createElement("br", null),
        startStopButton,
        React.createElement("hr", null),
        filterDiv,
        React.createElement("hr", null),
        listUl,
        React.createElement("br", null),
        React.createElement(
          "button",
          { onClick: this.next, disabled: nextDisabled },
          "Generate code"
        )
      );

      return ui;
    },

    // Go to next screen
    next: function next() {
      this.stopListening();
      this.props.next();
    },

    checkboxChanged: function checkboxChanged(checkboxName, ev) {
      this.props.filters[checkboxName] = ev.target.checked;
      this.props.setFilters(this.props.filters);
    },

    listChanged: function listChanged(listName, ev) {
      // Parse string into list and save
      var list = ev.target.value.split(",");
      list = list.map(function (item) {
        return item.trim();
      });
      this.props.filters[listName] = list;
      this.props.setFilters(this.props.filters);
    },

    renderList: function renderList() {
      var _this2 = this;

      if (!this.props.visibleObservations) {
        return "";
      }

      // Generate <li>s for each
      var listLis = this.props.visibleObservations.map(function (x) {
        var summary = x.selector + ', ' + x.type;
        var details = _this2.renderListDetails(x);
        var detailsToggle = x.expanded ? "-" : "+";
        var key = x.observationsIndex;
        return React.createElement(
          "li",
          { key: key,
            onMouseEnter: _this2.listHovered.bind(_this2, key, true),
            onMouseLeave: _this2.listHovered.bind(_this2, key, false) },
          React.createElement("input", { type: "checkbox", checked: x.checked, onChange: _this2.listCheckboxChanged.bind(_this2, key) }),
          React.createElement(
            "span",
            { onClick: _this2.listClicked.bind(_this2, key) },
            detailsToggle,
            " ",
            summary
          ),
          details
        );
      });
      return React.createElement(
        "ul",
        null,
        listLis
      );
    },

    renderListDetails: function renderListDetails(mutation) {
      if (!mutation.expanded) {
        return "";
      }
      var renderers = {
        "childList": this.renderListDetailsChildList,
        "attributes": this.renderListDetailsAttributes,
        "event": this.renderListDetailsEvent
      };
      var renderer = renderers[mutation.type] || _.constant("");
      var lis = renderer.call(this, mutation);
      return React.createElement(
        "ul",
        null,
        lis
      );
    },

    renderListDetailsChildList: function renderListDetailsChildList(mutation) {
      var lis = [];
      var info = mutation.childListType + " these elements:";
      var li = React.createElement(
        "li",
        null,
        info
      );
      lis.push(li);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = mutation.nodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var node = _step.value;

          lis.push(React.createElement(
            "li",
            null,
            explainNode(node)
          ));
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return lis;

      // Prints an added/removed node in a human-readable way
      function explainNode(node) {
        if (node.nodeName === '#text') {
          return '[text node] ' + node.textContent;
        }
        var tagName = node.tagName.toLowerCase();
        var id = node.id ? " id='" + node.id + "'" : "";
        var className = node.className ? " class='" + node.className + "'" : "";
        var content = node.textContent;

        return "<" + tagName + id + className + ">... " + content + " ...</" + tagName + ">";
      }
    },
    renderListDetailsAttributes: function renderListDetailsAttributes(mutation) {
      var lis = [React.createElement(
        "li",
        null,
        "Old value: ",
        mutation.attributeName,
        "=\"",
        mutation.oldValue,
        "\""
      ), React.createElement(
        "li",
        null,
        "New value: ",
        mutation.attributeName,
        "=\"",
        mutation.value,
        "\""
      )];
      return lis;
    },
    renderListDetailsEvent: function renderListDetailsEvent(mutation) {
      var lis = [React.createElement(
        "li",
        null,
        "Event name: ",
        mutation.eventName
      ), React.createElement(
        "li",
        null,
        "Target value: ",
        mutation.targetValue
      )];
      return lis;
    },

    listClicked: function listClicked(key) {
      var obs = this.props.observations.observations[key];
      obs.expanded = !obs.expanded;
      this.props.setObservations(this.props.observations);
    },

    listHovered: function listHovered(key, hovered) {
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
        };
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
          setTimeout(function () {
            // Element wasn't re-hovered? Reset it
            if (obs.target.resetIgnoreMyChange) {
              obs.target.ignoreMyChange = false;
            }
          }, 1);
        }
    },

    listCheckboxChanged: function listCheckboxChanged(key) {
      var observation = this.props.observations.observations[key];
      observation.checked = !observation.checked;
      this.props.setObservations(this.props.observations);
    },

    isHoverModification: function isHoverModification(mutation) {
      var target = mutation.target;
      if (target.ignoreMyChange) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          if (this.state.ignoreElStyle) {
            // Did we add a special style?
            var styleStr = target.getAttribute('style');
            var styleObj = parseStyle(styleStr);
            var shouldIgnore = _.every(this.state.ignoreElStyle, function (v, k) {
              return styleObj[k] === v;
            });
            if (shouldIgnore) return true;

            // Did we remove a special style?
            var styleObj = parseStyle(mutation.oldValue);
            var shouldIgnore = _.some(this.state.ignoreElStyle, function (v, k) {
              return styleObj[k] === v;
            });
            if (shouldIgnore) return true;
          }
        }
      }
      return false;
    },

    startListening: function startListening() {
      console.log('listening');
      var observations = new Observations();
      this.props.setObservations(observations);

      this.startListeningEvents();
      this.startListeningMutations();
      this.props.setListening(true);
    },

    // Start listening for user events
    startListeningEvents: function startListeningEvents() {
      console.log('startListeningEvents');

      // TODO why aren't 'event happened' printed before a DOM modification?
      // We're interested in user events!
      // TODO put behind boolean
      // TODO filter out events on our UI
      // TODO add observations
      var self = this;
      globalEventHandler = function globalEventHandler(ctx, name, event) {
        // console.log('event happened', arguments);
        // Do not include DOM modifications to our UI
        var target = event.target;
        var ourUI = self.props.rootEl.contains(target);
        if (ourUI) {
          return;
        }
        self.props.observations.addEvent(target, name, event);
        self.props.setObservations(self.props.observations);
      };
    },

    // Start listening for DOM mutations
    startListeningMutations: function startListeningMutations() {
      var _this3 = this;

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          var target = mutation.target;
          var ourUI = _this3.props.rootEl.contains(target); // Do not include DOM modifications to our UI
          var ourModification = _this3.isHoverModification(mutation); // Do not include attribute modifications we caused
          if (ourUI || ourModification) {
            return;
          }

          switch (mutation.type) {
            case "attributes":
              var attributeName = mutation.attributeName;
              var value = target.getAttribute(mutation.attributeName);
              var oldValue = mutation.oldValue;
              if (value !== oldValue) {
                _this3.props.observations.addAttribute(target, attributeName, oldValue, value);
                _this3.props.setObservations(_this3.props.observations);
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
              _this3.props.observations.addChildList(target, type, nodes);
              _this3.props.setObservations(_this3.props.observations);
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
      };
      observer.observe(rootNode, opts);

      this.props.setObserver(observer);
    },

    stopListening: function stopListening() {
      console.log('stop listening');
      globalEventHandler = function globalEventHandler() {};
      console.log(this.props.observations.observations);
      this.props.observer.disconnect();
      this.props.setListening(false);
    }

  });

  var CodeGeneration = React.createClass({
    displayName: "CodeGeneration",


    getInitialState: function getInitialState() {
      return {
        testFramework: "casperjs"
      };
    },

    testFrameworkChanged: function testFrameworkChanged(ev) {
      this.setState({
        testFramework: ev.target.value
      });
      console.log(arguments);
    },

    render: function render() {
      var select = React.createElement(
        "select",
        { value: this.state.testFramework, onChange: this.testFrameworkChanged },
        React.createElement(
          "option",
          { value: "casperjs" },
          "CasperJS"
        )
      );
      // <option value="selenium">Selenium</option>

      if (!this.props.chosenObservations) {
        var code = "No chosen observations";
      } else {
        if (this.state.testFramework == "casperjs") {
          var cg = new CasperCodeGenerator();
        } else if (this.state.testFramework == "selenium") {
          console.log("TODO implement selenium");
          var cg = new CasperCodeGenerator();
        }
        var code = cg.generateCode(this.props.chosenObservations);
      }

      return React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          { onClick: this.props.back },
          "Back"
        ),
        React.createElement("br", null),
        select,
        React.createElement("hr", null),
        code
      );
    }

  });

  var newDiv = document.createElement("div");
  document.body.appendChild(newDiv);

  var iframeId = "myLilIframe-" + Math.round(Math.random() * 10000000000);
  var iframe = React.createElement(
    Frame,
    {
      id: iframeId,
      css: contentCss },
    React.createElement(MainView, { rootEl: newDiv })
  );
  addIframeStyles(iframeId);
  ReactDOM.render(iframe, newDiv);
}

function CasperCodeGenerator() {
  this.reset();
}
CasperCodeGenerator.prototype.reset = function () {
  this.attributeChanged = false;
};

CasperCodeGenerator.prototype.waitForAttributeTemplate = "\n// CasperJS helper that waits until 'selector' gets a specific attribute\ncasper.waitForAttribute = function (selector, attributeName, attributeValue, cb) {\n  this.waitFor(function () {\n    var value = this.getElementAttribute(selector, attributeName);\n    return value === attributeValue;\n  }, cb);\n}\n";

CasperCodeGenerator.prototype.generateCode = function (observations) {
  var jss = observations.map(this._generateCode.bind(this));
  if (this.attributeChanged) {
    var waitForAttributeTemplate = this.waitForAttributeTemplate.split('\n');
    waitForAttributeTemplate = [].concat(_toConsumableArray(intersperse(waitForAttributeTemplate, React.createElement("br", null))));
    jss.unshift(waitForAttributeTemplate);
  }
  jss = [].concat(_toConsumableArray(intersperse(jss, React.createElement("br", null))));
  var js = _.flattenDeep(jss);
  console.log(jss);
  console.log(js);

  this.reset();
  return js;
};
CasperCodeGenerator.prototype._generateCode = function (observation) {
  var codeGenerators = {
    'childList': this._childList,
    'attributes': this._attributes,
    'event': this._event
  };
  var js = codeGenerators[observation.type].call(this, observation);
  return [js];
};
CasperCodeGenerator.prototype._childList = function (observation) {
  console.log('observation cl:', observation);
  var childSelectors = Array.prototype.slice.call(observation.nodes).map(function (node) {
    return getSelector(node);
  });
  if (observation.childListType === 'added') {
    var js = childSelectors.map(function (childSelector) {
      return "casper.waitForSelector('" + childSelector + "');";
    });
  } else if (observation.childListType === 'removed') {
    var js = childSelectors.map(function (childSelector) {
      return "casper.waitWhileSelector('" + childSelector + "');";
    });
  }
  return [].concat(_toConsumableArray(intersperse(js, React.createElement("br", null))));
};
CasperCodeGenerator.prototype._attributes = function (observation) {
  console.log('observation at:', observation);
  this.attributeChanged = true;
  return "casper.waitForAttribute('" + observation.selector + "', '" + observation.attributeName + "', '" + observation.value + "');";
};
CasperCodeGenerator.prototype._event = function (observation) {
  console.log('observation at:', observation);
  switch (observation.eventName) {
    case "click":
      return "casper.click('" + observation.selector + "');";
    case "input":
      // TODO: reset, keepFocus, modifiers?
      return "casper.sendKeys('" + observation.selector + "', '" + observation.targetValue + "', {reset: true});";

  }
};

// ----------------------------------------------------------------------------
// Utils

function getSelector(node) {
  var my_selector_generator = new CssSelectorGenerator();
  return my_selector_generator.getSelector(node);
}

function getScript(src, callback) {
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onreadystatechange = s.onload = function () {
    if (!callback.done && (!s.readyState || /loaded|complete/.test(s.readyState))) {
      callback.done = true;
      callback();
    }
  };
  document.querySelector('head').appendChild(s);
}

function parseStyle(styleStr) {
  if (!styleStr) return {};
  styleStr = styleStr.trim();
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
  if (observation.type !== 'attributes' || observation.attributeName !== 'style') return false;
  var style = parseStyle(observation.value);
  var oldStyle = parseStyle(observation.oldValue);

  // Both style objects should have exactly the same keys (e.g. 'opacity')
  var styleKeys = Object.keys(style);
  var oldStyleKeys = Object.keys(oldStyle);
  var changedKeys = _.xor(styleKeys, oldStyleKeys);
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

function intersperse(a, delim) {
  var first, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, x;

  return regeneratorRuntime.wrap(function intersperse$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          first = true;
          _iteratorNormalCompletion2 = true;
          _didIteratorError2 = false;
          _iteratorError2 = undefined;
          _context.prev = 4;
          _iterator2 = a[Symbol.iterator]();

        case 6:
          if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
            _context.next = 17;
            break;
          }

          x = _step2.value;

          if (first) {
            _context.next = 11;
            break;
          }

          _context.next = 11;
          return delim;

        case 11:
          first = false;
          _context.next = 14;
          return x;

        case 14:
          _iteratorNormalCompletion2 = true;
          _context.next = 6;
          break;

        case 17:
          _context.next = 23;
          break;

        case 19:
          _context.prev = 19;
          _context.t0 = _context["catch"](4);
          _didIteratorError2 = true;
          _iteratorError2 = _context.t0;

        case 23:
          _context.prev = 23;
          _context.prev = 24;

          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }

        case 26:
          _context.prev = 26;

          if (!_didIteratorError2) {
            _context.next = 29;
            break;
          }

          throw _iteratorError2;

        case 29:
          return _context.finish(26);

        case 30:
          return _context.finish(23);

        case 31:
        case "end":
          return _context.stop();
      }
    }
  }, _marked[0], this, [[4, 19, 23, 31], [24,, 26, 30]]);
}

// ----------------------------------------------------------------------------
// Define styles of iframe and its contents

// Adds iframe styles to the document's <head>
function addIframeStyles(iframeId) {
  var css = "#" + iframeId + " { " + iframeCss + " }";
  // Add CSS
  var style = document.createElement("style");
  style.type = 'text/css';
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
  document.head.appendChild(style);
}

var iframeCss = "\n      padding: 5px;\n      position: absolute;\n      top: 20px;\n      left: 20px;\n      z-index: 9000000;\n      background: whitesmoke;\n      max-height: 100%;\n      max-width: 80%;\n      overflow: scroll;\n      border-radius: 15px;\n";

var contentCss = "\n    #waitWhat {\n      background: whitesmoke;\n      font-size: 100%;\n      color: #333333;\n      font-family: 'open sans', sans-serif;\n      font-weight: normal;\n      box-shadow: 2px 2px 5px 0px rgba(0,0,0,0.75);\n    }\n    #waitWhat input {\n      font-size: 100%;\n      font-weight: initial;\n      border: 1px solid #d1d1d1;\n      padding: 7px 10px;\n    }\n    #waitWhat button {\n      border-radius: 5px;\n      background-color: #18aae7;\n      color: white;\n      text-transform: none;\n      font-size: 100%;\n      height: auto;\n      width: auto;\n      padding: 5px 10px 5px 10px;\n      margin: 0px;\n    }\n    #waitWhat label {\n      display: inline;\n    }\n  ";

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