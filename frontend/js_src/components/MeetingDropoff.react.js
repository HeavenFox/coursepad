/**
 * @jsx React.DOM
 */
var schedules = require('../store/schedules.js');
var CalendarElementMixin = require('./CalendarElementMixin.react.js');

var ana = require('../analytics/analytics.js');

var MeetingDropoff = React.createClass({
    mixins : [CalendarElementMixin],

    componentDidMount: function() {
        var self = this;
        $(this.refs['dropoff'].getDOMNode()).droppable({drop: function(event, ui) {
            self.onDropped(ui.draggable.attr('data-nbr'));

        },
        greedy: true,
        over: function() {
            self._onHover();
        },
        out: function() {
            self._onHoverEnd();
        }
        });
    },

    onDropped: function(fromClassNumber) {
        schedules.getCurrentSchedule().changeSection(this.props['nbr'], fromClassNumber);

        ana.sevent('course', 'change_section_drop', fromClassNumber + '->' + this.props['nbr']);
    },

    _onHover: function() {
        $('.mtdropoff-' + this.props['nbr']).addClass('mtdropoff-highlight');
    },

    _onHoverEnd: function() {
        $('.mtdropoff-' + this.props['nbr']).removeClass('mtdropoff-highlight');
    },

    render: function() {
        var meetings = this.props['times'];
        var style = this.getLayoutStyle();
        if (!Array.isArray(meetings)) {
            meetings = [meetings];
        }
        var classNames = 'mtdropoff mtdropoff-' + this.props['nbr'] + ' ' + this.getClassName();
        return <div className={classNames} style={style} ref="dropoff">
            <div className="mtdropoff-inner">
            {meetings.map(function(item) {
                return <p className="mtdropoff-time">{item}</p>;
            })}
            <p className="mtdropoff-loc">{this.props['location']}</p>
            </div>
        </div>;

    }
});

module.exports = MeetingDropoff;