/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');
var localStore = require('../../persist/localStorage.js');
var UnsupportedBrowserWarning = React.createClass({
    _close: function() {
        if (this.refs['dont-warn'].getDOMNode().checked) {
            localStore.set('dont-warn-unsupported-browser', true);
        }
        modal.stop();

    },

    render: function() {
        var title;
        var callToAction;
        var dontWarn = false;
        if (this.props['reason'] == 'safari') {
            title = 'You Seem to be using Safari, but...';
            callToAction = <div><p>Safari has a bug that made CoursePad.me slower than usual. It may take you five to ten minutes to download all classes the first time you select a semester, and several seconds each time you open the website.</p>
                <p>You may choose to continue, or you may use one of our supported browsers: <a href="https://www.google.com/chrome/">Chrome</a> or <a href="http://www.firefox.com">Firefox</a></p></div>
            dontWarn = true;
        } else if (this.props['reason'] == 'feature') {
            title = "Your Browser is Too Old";
            callToAction = <div><p>CoursePad.me uses latest web technologies to deliver seamless experience, and therefore need a newer browser to function.</p>
                <p>We strongly recommend that you download the latest version of <a href="https://www.google.com/chrome/">Chrome</a> or <a href="http://www.firefox.com">Firefox</a></p>
                <p>You may continue anyway, but CoursePad.me may not work.</p>
            </div>
        }

        return <div className="modal-window-inner unsupported-browser">
            <div className="sadface">:-(</div>
            <div className="unsupported-browser-content">
            <h3>{title}</h3>
            {callToAction}
            <div><input type="checkbox" ref="dont-warn" id="dontwarn" defaultChecked={dontWarn} onChange={this._onChange} /><label htmlFor="dontwarn">Don't warn me again</label></div>
            <div className="close-btn-container">
                <div className="close-btn" onClick={this._close}>Close</div>
            </div>
            </div>
        </div>


        
    }
});

module.exports = UnsupportedBrowserWarning;