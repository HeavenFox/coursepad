/**
 * @jsx React.DOM
 */
var termdb = require('../store/termdb.js');
var schedules = require('../store/schedules.js');

var SearchBar = React.createClass({
    componentWillMount: function() {
        schedules.on('readystatechange', this.termDBReadyStateChange);
    },

    componentDidUnmount: function() {
        schedules.off('readystatechange', this.termDBReadyStateChange);
    },

    termDBReadyStateChange: function() {
        this.setState({available: schedules.ready});
    },

    getInitialState: function() {
        return {available: schedules.ready};
    },

    renderItem: function(ul, item) {
        var $item = $('<li />');
        var $title = $('<p />');
        for (var i=0; i < item.segments.length; i++) {
            $title.append(document.createTextNode(
                item.title.slice(
                    i === 0 ? 0 : item.segments[i-1][1],
                    item.segments[i][0]
                )
            ));
            $title.append($('<em />').text(item.title.slice(
                item.segments[i][0],
                item.segments[i][1]
            )));
        }
        if (item.segments.length > 0) {
            $title.append(document.createTextNode(
                item.title.slice(item.segments[item.segments.length-1][1])
            ));
        }
        $item.append($title);
        ul.append($item);
        return $item;
    },
    dataSource: function(request, response) {
        var currentDB = termdb.getCurrentTerm();
        if (!currentDB) {
            return;
        }
        currentDB.searchByKeyword(request.term).then(function(result) {
            response(result);
        });
    },
    componentDidMount: function() {
        var that = this;
        $(this.getDOMNode()).autocomplete({
            minLength: 2,
            source: this.dataSource,
            select: function(event, ui) {
                schedules.getCurrentSchedule()
                         .addCourse(ui.item.course[0], ui.item.course[1]);
            }
        }).autocomplete("instance")._renderItem = this.renderItem;
    },
    render: function() {
        return <input type="text" autoComplete="off" disabled={!this.state.available} placeholder={this.state.available ? "Search for Class (e.g. CS3110; Intro to Photography)" : "Loading Available Classes..."} />;
    }
});

module.exports = SearchBar;