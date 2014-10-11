/**
 * @jsx React.DOM
 */
var CalendarElementMixin = require('./CalendarElementMixin.react.js');

var ConflictIndicator = React.createClass({
    mixins : [CalendarElementMixin],

    render: function() {
        return <div className={'conflict-indicator ' + this.getClassName()} style={this.getLayoutStyle()}></div>
    }
});

module.exports = ConflictIndicator;