var schedules = require('../../store/schedules.js');
var termdb = require('../../store/termdb.js');

var UpdateAvailable = React.createClass({
    getInitialState: function() {
        return {updating: false};
    },

    _update: async function() {
        var self = this;
        this.setState({updating: true});
        await termdb.getCurrentTerm().applyUpdates(this.props.updates);
        self.props.onFinish();
    },

    render: function() {
        var text;
        if (this.state.updating) {
            text = <p>Updating...</p>
        } else {
            text = <p>Your Current Roster is Out of Date. Click <a href="javascript:;" onClick={this._update}>Here</a> to Update</p>
        }

        return <div className="banner">{text}</div>
    }
});

module.exports = UpdateAvailable;