/**
 * @jsx React.DOM
 */
var ClassNumbers = require('../pagelets/ClassNumbers.react.js');
var ImportExport = require('../pagelets/ImportExport.react.js');
var modal = require('../../utils/modal.js');

var Tools = React.createClass({
    _showClassNumbers: function() {
        modal.show(<ClassNumbers />);
    },

    _importExport: function() {
        modal.show(<ImportExport />);
    },

    render: function() {
        return <div className="tools utilities-item">
        <h2>Tools</h2>
            <ul>
                <li><a href="javascript:;" onClick={this._showClassNumbers}>Show Class Numbers</a></li>
                <li><a href="javascript:;" onClick={this._importExport}>Import / Export</a></li>
            </ul>
        </div>;
    }
});

module.exports = Tools;