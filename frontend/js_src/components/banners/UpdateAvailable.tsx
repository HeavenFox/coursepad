import schedules from '../../store/schedules.ts';
import termdb from '../../store/termdb.ts';
import {LocalTermDatabase} from '../../model/termdb.ts'

var UpdateAvailable = React.createClass({
    getInitialState: function() {
        return {updating: false};
    },

    _update: async function() {
        var self = this;
        this.setState({updating: true});
        let db = termdb.getCurrentTerm();
        if (db instanceof LocalTermDatabase) {
            await db.applyUpdates(this.props.updates);
        }
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

export default UpdateAvailable;
