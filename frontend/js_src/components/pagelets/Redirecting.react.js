/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');

var Redirecting = React.createClass({

    render: function() {
        return <div className="splash-screen">
            <div className="splash-screen-inner">
        <h2>Redirecting you to https://coursepad.me...</h2>
        <p>To disable automatic redirection, visit <a href="http://beta.coursepad.me/#noredirect">http://beta.coursepad.me/#noredirect</a></p>
            </div>
        </div>
    }
});

module.exports = Redirecting;