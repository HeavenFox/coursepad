/**
 * @jsx React.DOM
 */
var schedules = require('../store/schedules.js');
var CalendarElementMixin = require('./CalendarElementMixin.react.js');

var MeetingDropoff = React.createClass({
    mixins : [CalendarElementMixin],

    componentDidMount: function() {
        var self = this;
        $(this.refs['dropoff'].getDOMNode()).droppable({drop: function(event, ui) {
            self.onDropped(ui.draggable.attr('data-nbr'))

        }});
    },

    onDropped: function(fromClassNumber) {
        console.log(fromClassNumber);
        console.log(this.props['nbr']);

        schedules.getCurrentSchedule().changeSection(fromClassNumber, this.props['nbr']);

    },

    render: function() {
        var meetings = this.props['times'];
        var style = this.getLayoutStyle();
        if (!Array.isArray(meetings)) {
            meetings = [meetings];
        }
        var classNames = 'calele mtdropoff calele-' + this.props['day'].toLowerCase();
        return <div className={classNames} style={style} ref="dropoff">
            <div className="mtdropoff-inner">
            {meetings.map(function(item) {
                return <p className="mtdropoff-time">{item}</p>;
            })}
            </div>
        </div>;

    }
});

module.exports = MeetingDropoff;