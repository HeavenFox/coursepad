/**
 * @jsx React.DOM
 */
var schedules = require('../../store/schedules.js');

var BasicInfo = React.createClass({
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
        var newState = schedules.getCurrentSchedule().getBasicInfo();
        newState['conflicts'] = schedules.getCurrentSchedule().getConflictIntervals().length > 0;
        this.setState(newState);
    },

    _toggleAlwaysShowConflicts: function() {
        this._alwaysShowConflicts = !this._alwaysShowConflicts;
        if (this._alwaysShowConflicts) {
            this._showConflicts();
        } else {
            this._hideConflicts();
        }
    },

    _showConflicts: function() {
        $('#conflict-overlay').addClass('show');

    },

    _hideConflicts: function() {
        if (!this._alwaysShowConflicts) {
            $('#conflict-overlay').removeClass('show');
        }
    },

    getInitialState: function() {
        return {units: [0,0], classes: 0, hours: 0, conflicts: false};
    },
    render: function() {
        var conflict = null;
        if (this.state.conflicts) {
            conflict = <div className="basic-info-conflict"
                            onMouseOver={this._showConflicts}
                            onMouseOut={this._hideConflicts}
                            onClick={this._toggleAlwaysShowConflicts}>Note: this schedule has conflicts</div>
        }

        var creditIsRange = this.state['units'][0] != this.state['units'][1];
        return <div className="basic-info-container">
            <div className="basic-info">
                <p className={'basic-info-value total-credit' + (creditIsRange ? ' total-credit-range' : '')}>
                    {creditIsRange ? this.state['units'][0] + '-' + this.state['units'][1] : this.state['units'][0]}
                </p>
                <p className="basic-info-title">UNITS</p>
            </div>
            <div className="basic-info">
                <p className={'basic-info-value total-classes'}>
                    {this.state['classes']}</p>
                <p className="basic-info-title">{this.state['classes'] > 1 ? "CLASSES" : "CLASS"}</p>
            </div>
            <div className="basic-info">
                <p className={'basic-info-value weekly-hours'}>
                    {Math.round(this.state['hours'] * 10) / 10}</p>
                <p className="basic-info-title">{this.state['hours'] > 1 ? "HRS/WK" : "HR/WK"}</p>
            </div>
            <div style={{clear: 'both'}} />
            {conflict}
        </div>
    }
});

module.exports = BasicInfo;