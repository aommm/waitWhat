
casper.start('file:///Users/aom/waitWhat/testbed.html', {
  verbose: true,
  logLevel: "debug"
});


casper.waitForAttribute = function (selector, attributeName, attributeValue, cb) {
  this.waitFor(function () {
    var value = this.getElementAttribute(selector, attributeName);
    return value === attributeValue;
  }, cb);
}

describe('Apps', function() {
  var appName = "En liten testapp "+ (+new Date());
  console.log('new app name:', appName);

  // before(function () {
  //   utils.ensureAtDashboard();
  // });

  it('is logged in', function () {
    // Don't wait for change if already logged in
    // Wait until email appears
    // casper.waitForSelectorTextChange("#user-email");
    
    casper.then(function () {
      this.waitForText("Add element");
      this.click("#addElement");
      this.waitForText("hej svejs 0");
      this.click("#changeAttribute");
      this.waitForAttribute('#container > :nth-child(3)', 'style', 'asdf 1234 1');

    })
  });

});