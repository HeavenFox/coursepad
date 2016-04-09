import schedules from '../../store/schedules.ts';
import {SharedSchedule, MutableSchedule} from '../../model/schedules.ts';
import moment from 'moment';

import * as ana from '../../analytics/analytics.ts';

interface WeekSelectorProps {
    all: boolean;
    startMoment?: any;
    endMoment?: any;
    hasNext: boolean;
    hasPrev: boolean;
    move: Function;
    enableAll: Function;
}

class WeekSelector extends React.Component<WeekSelectorProps, any> {
    render() {
        let noop = (e) => {}
        const shortDateFormat = 'MM/DD';
        const longDateFormat = 'MMM D, YYYY';
        let dates = <div className="dateinterval">-</div>;
        if (this.props.startMoment && this.props.endMoment) {
            dates = <div className="dateinterval">
                        <div className="dateinterval-long">{this.props.startMoment.format(longDateFormat) + ' - ' + this.props.endMoment.format(longDateFormat)}</div>
                        <div className="dateinterval-short">{this.props.startMoment.format(shortDateFormat) + ' - ' + this.props.endMoment.format(shortDateFormat)}</div>
                    </div>;
        }
        let allButton = <div className={'week-selector-btn all-btn' + (this.props.all ? '' : ' unselected')} onClick={this.props.all ? undefined : e => this.props.enableAll(true)}>ALL</div>;

        let weekClickable = this.props.all && this.props.startMoment && this.props.endMoment;
        let weekButton = <div className={'week-selector-btn week-btn' + (this.props.all ? ' unselected' : '') + (weekClickable ? ' clickable' : '')} onClick={weekClickable ? e => this.props.enableAll(false) : undefined}>
                <div className={"prev-week" + (this.props.hasPrev ? ' enabled' : ' disabled')} onClick={this.props.hasPrev && !weekClickable ? this.props.move.bind(null, -1) : noop}>&#9664;</div>
                <div className="current-week">{dates}</div>
                <div className={"next-week" + (this.props.hasNext ? ' enabled' : ' disabled')} onClick={this.props.hasNext && !weekClickable ? this.props.move.bind(null, 1) : noop}>&#9654;</div>
            </div>;
        return <div className="week-selector">{allButton}{weekButton}</div>;
    }
}

var BasicInfo = React.createClass({
    componentWillMount: function() {
        schedules.on('readystatechange', this._onReadyStateChange);
        schedules.on('change', this._update);

    },
    componentWillUnmount: function() {
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
        var curSchedule = schedules.getCurrentSchedule();
        var newState : any = curSchedule.getBasicInfo();
        newState.conflicts = curSchedule.getConflictIntervals().length > 0;
        newState.isSharing = curSchedule instanceof SharedSchedule;
        newState.isMutable = curSchedule instanceof MutableSchedule;
        this.setState(newState);
    },

    _toggleAlwaysShowConflicts: function() {
        var showState = !this.state['showConflicts'];
        this.setState({'showConflicts': showState});
        if (showState) {
            this._showConflicts();
        } else {
            this._hideConflicts();
        }

        ana.sevent('basicinfo', 'toggle_always_conflict');
    },

    _mouseoverConflict: function() {
        this._showConflicts();

        ana.sevent('basicinfo', 'hover_show_conflict');
    },

    _showConflicts: function() {
        $('#conflict-overlay').addClass('show');
    },

    _hideConflicts: function() {
        $('#conflict-overlay').removeClass('show');
    },

    _hideConflictsIfNotPinned: function() {
        if (!this.state['showConflicts']) {
            this._hideConflicts();
        }
    },

    getInitialState: function() {
        return {units: [0,0], classes: 0, hours: 0, conflicts: false, showConflicts: false, isSharing: false, isMutable: false};
    },

    render: function() {
        var conflict = null;
        if (this.state.conflicts) {
            conflict = <div className={"basic-info-conflict" + (this.state.showConflicts ? ' showing' : '')}
                            onMouseOver={this._mouseoverConflict}
                            onMouseOut={this._hideConflictsIfNotPinned}
                            onClick={this._toggleAlwaysShowConflicts}>
                                <p>Conflict Schedule</p>
                        </div>
        }

        var isSharing = this.state.isSharing ? <h2>Shared Schedule</h2> : null;

        var creditIsRange = this.state['units'][0] != this.state['units'][1];

        let startMoment, endMoment;
        [startMoment, endMoment] = schedules.getWeekIntervalMoments();
        if (endMoment) endMoment = moment(endMoment).subtract(1, 'd');

        let weekSelector = null;

        if (schedules.ready && schedules.hasWeekIntervals()) {
            weekSelector = <WeekSelector all={schedules.showAllWeeks()}
                                         hasNext={schedules.hasNext()} hasPrev={schedules.hasPrev()}
                                         startMoment={startMoment} endMoment={endMoment}
                                         move={ schedules.moveWeek.bind(schedules) }
                                         enableAll={ schedules.setShowAllWeeks.bind(schedules) } />;
        }


        return <div className={"utilities-item basic-info-container" + (this.state.conflicts ? ' conflicts' : '') + (this.state.isMutable ? ' mutable' : '')}>
            {isSharing}
            <div className="basic-info-fixh">
            <div className={"basic-info-stats" + (creditIsRange ? ' total-credit-range' : '')}>
            <div className="basic-info">
                <p className={'basic-info-value total-credit'}>
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
            </div>
            <div className="basic-info-conflict-container">
            {conflict}
            </div>
            </div>
            {weekSelector}
        </div>
    }
});

export default BasicInfo;
