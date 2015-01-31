/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');

var MigrationNotice = React.createClass({
    _close: function() {
        modal.stop();
    },

    _migrate: function() {
        var localStorage = {};
        for (var k in window.localStorage) {
            if (k.split('_')[1] === 'schedules') {
                localStorage[k] = window.localStorage[k];
            }
        }

        var data = {'localStorage' : localStorage};

        this.refs['data'].getDOMNode().value = JSON.stringify(data);
        this.refs['form'].getDOMNode().submit();

    },

    render: function() {
        return <div className="splash-screen">
            <div className="splash-screen-header"></div>
            <div className="splash-screen-inner">
            <h2>A New Version of CoursePad.me is Available</h2>
            <p>Click the button below to migrate your schedules to the new version</p>

            <form method="post" action="https://coursepad.me/endpoints/conduit/" ref="form">
            <input type="hidden" name="data" ref="data" />
            </form>
            <div className="start-using-btn-container">
                <div className="start-using-btn" onClick={this._migrate}>Migrate to New CoursePad.me</div>
                <div className="btnish" onClick={this._close}>Continue Using CoursePad.me Beta</div>
            </div>
            </div>
        </div>
    }
});

module.exports = MigrationNotice;