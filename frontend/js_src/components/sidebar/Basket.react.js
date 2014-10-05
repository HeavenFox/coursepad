/**
 * @jsx React.DOM
 */
var schedules = require('../../store/schedules.js');

var Basket = React.createClass({
    componentWillMount: function() {
        schedules.on('readystatechange', this._onReadyStateChange);
        schedules.on('change', this._update);

    },
    componentDidUnmount: function() {
        schedules.off('readystatechange', this._onReadyStateChange);
        schedules.off('change', this._update);

    },

    _onReadyStateChange: function() {
        if (schedules.ready) {
            this._update();
        } else {
            this.setState(this.getInitialState());
        }
    },

    _update: function() {
        this.setState({clusters: schedules.getCurrentSchedule().basket,
                       sections: schedules.getCurrentSchedule().sections,
                       visibility: schedules.getCurrentSchedule().courseVisibility,
                       expansion: {}});
    },

    getInitialState: function() {
        return {clusters: [], sections: [], visibility: {}};
    },
    render: function() {
        var clusters = this.state.clusters.map(function(cluster) {
            var number = cluster[0].getNumber();
            var clusterItems = [];
            var className = schedules.getCurrentSchedule().getColorForCourse(cluster[0].subject, cluster[0].number);

            if (cluster.length === 1) {
                var sections = cluster[0].getAllSections();
                clusterItems = sections.map(function(section) {
                    return <div className="content level-2">{section.type + ' ' + section.sec}</div>

                });

            } else {
                clusterItems = cluster.map(function(course) {
                    return <div className="content level-2">{course.subject + ' ' + course.number}</div>

                });

            }


            return <div className={"basket-item " + className}>
                <div className="content">
                    <div className="content-buttons">M V E</div>
                {number + ": "}
                <span className="content-title">{cluster[0].title}</span>
                </div>
                {clusterItems}
            </div> 

        });

        return <div className="basket">
        {clusters}
        </div>
    }
});

module.exports = Basket;