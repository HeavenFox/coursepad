/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');

var SplashScreen = React.createClass({
    _close: function() {
        modal.stop();
    },

    render: function() {
        return <div className="splash-screen">
            <div className="splash-screen-header"></div>
            <div className="splash-screen-inner">
            <h2>Welcome to CoursePad.me</h2>
            <p>CoursePad.me is the new way to schedule your courses at Cornell.</p>
            <p><em>Note:</em> we store all your schedules in your browser. Please do not clear browsing history or use CoursePad.me in incognito mode, or you will lose your data.</p>

            <div className="splash-screen-item-container">
                <div className="splash-screen-item">
                    <div className="splash-screen-fast-img" />
                    <h3>Fast and Powerful</h3>
                    <p>Drag and drop between different time options. See live statistics. Highlight conflicts. All done in fraction of a second. CoursePad.me provides you the tools you need to create an optimal schedule.</p>
                </div>
                <div className="splash-screen-item">
                    <div className="splash-screen-247-img" />
                    <h3>Never Down</h3>
                    <p>CoursePad.me stores all your data on your own computer and don't need to constantly talk to the server. So it will never break down during pre-enroll, exactly when you need it the most.</p>
                </div>
                <div className="splash-screen-item">
                    <div className="splash-screen-support-img" />
                    <h3>Actively Supported</h3>
                    <p>CoursePad.me is under active development, with new features being added constantly. Want something to happen? Shoot an email to feedback@coursepad.me, and we'll do our best.</p>
                </div>
                <div className="clearboth" />
            </div>
            <div className="start-using-btn-container">
                <div className="start-using-btn" onClick={this._close}>Start Using CoursePad.me</div>
            </div>
            </div>
        </div>
    }
});

module.exports = SplashScreen;