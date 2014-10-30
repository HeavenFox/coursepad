/**
 * @jsx React.DOM
 */
var ClassNumbers = require('../pagelets/ClassNumbers.react.js');
var modal = require('../../utils/modal.js');

var Tools = React.createClass({
    _showClassNumbers: function() {
        modal.show(<ClassNumbers />);
    },

    render: function() {
        return <div className="tools utilities-item">
        <h2>Tools</h2>
            <ul>
                <li><a href="javascript:;" onClick={this._showClassNumbers}>Show Class Numbers</a></li>
            </ul>
        </div>
    }
});

module.exports = Tools;