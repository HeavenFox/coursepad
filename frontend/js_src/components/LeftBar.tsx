import schedules from '../store/schedules.ts';
var schedulestorage : any = require('../store/schedulestorage.js');
import * as ana from '../analytics/analytics.ts';

interface ScheduleIconProps {
    color: string;
    fill: boolean;
}

var ScheduleIcon = React.createClass<ScheduleIconProps, any>({
    render: function() {
        var color = this.props.color;
        var fill = this.props.fill ? color : 'transparent';
        return <svg className="schedule-logo" width="17" height="17" version="1.1">
          <rect x="0.5" y="0.5" width="16" height="4" fill={fill} stroke={color} strokeWidth="1" />
          <rect x="0.5" y="6.5" width="7" height="4" fill={fill} stroke={color} strokeWidth="1" />
          <rect x="0.5" y="12.5" width="7" height="4" fill={fill} stroke={color} strokeWidth="1" />
          <rect x="9.5" y="6.5" width="7" height="4" fill={fill} stroke={color} strokeWidth="1" />
          <rect x="9.5" y="12.5" width="7" height="4" fill={fill} stroke={color} strokeWidth="1" />
        </svg>;
    }
});

interface ScheduleLineProps {
    key: string;
    name: string;
    color: string;
    isCurrent: boolean;
    editing: boolean;
    onSave: Function;
    onCancel?: Function;
    onDelete?: Function;
    onClick?: Function;
}

var ScheduleLine = React.createClass<ScheduleLineProps, any>({
    getInitialState: function() {
        return {
            name: this.props.name,
            editing: !!this.props.editing
        }
    },

    _onInputChange: function(e) {
        this.setState({name: e.target.value});
    },

    _onSave: function(e) {
        this.props.onSave(this.state.name, this.props.color);
        this.setState({editing: false});
    },

    _onEdit: function(e) {
        this.setState({editing: true}, this._focusIfNeeded);
        e.stopPropagation();
    },

    _onDelete: function() {
        this.props.onDelete();
    },

    _onClick: function() {
        if (this.props.onClick) {
            this.props.onClick();
        }
    },

    _onCancel: function() {
        this.setState({editing: false});
        if (this.props.onCancel) {
            this.props.onCancel();
        }
    },


    _onKeyUp: function(e) {
        if (e.keyCode === 13) { // enter
            this._onSave();
        } else if (e.keyCode === 27) { // esc
            this._onCancel();
        }
    },

    _focusIfNeeded: function() {
        if (this.state.editing) {
            var node = this.refs['input'];
            node.focus();
            node.select();
        }
    },

    componentDidMount: function() {
        this._focusIfNeeded();
    },

    render: function() {
        var content;

        if (this.state.editing) {
            content = <input type="text" value={this.state.name} onKeyUp={this._onKeyUp} onChange={this._onInputChange} ref="input" />;
        } else {
            content = this.state.name;
        }
        var editing = [];

        if (this.state.editing && !this.props.isCurrent && !this.props.editing) {
            editing.push(<div key="del" onClick={this._onDelete} className="glyphicon glyphicon-trash clickable" />);
        }
        editing.push(<div key="save" onClick={this.state.editing ? this._onSave : this._onEdit} className={(this.state.editing ? "glyphicon-floppy-disk" : "glyphicon-pencil") + " glyphicon clickable"} />);
        return <li onClick={this.state.editing ? null : this._onClick} className={this.state.editing ? "" : "btnish"}>
                <ScheduleIcon color={this.props.color} fill={this.props.isCurrent} />
                <div className="schedule-listing-content">{content}</div>
                <div className="schedule-listing-edit-opts">
                    {editing}
                </div>
               </li>;
    }
});

var LeftBar = React.createClass({
    _onHover: function() {
        $('#main-container').addClass('schedules-open');
    },

    _onOut: function() {
        $('#main-container').removeClass('schedules-open');
    },

    getInitialState: function() {
        return {
            schedules: null,
            creating: false
        };
    },

    componentDidMount: function() {
        var handler = (function(){
            if (schedules.ready) {
                this.setState({schedules: schedulestorage.getAllSchedules()});
            }
        }).bind(this);
        schedules.on('readystatechange', handler);
        schedulestorage.on('listchange', handler);
    },

    _addSchedule: function() {
        this.setState({creating: true});
    },

    _saveNewSchedule: function(name, color) {
        schedulestorage.addSchedule(name, color);
        ana.sevent('multischedule', 'add', schedulestorage.numberOfSchedules());
        this.setState({creating: false});
    },

    _saveExistingSchedule: function(index, name) {
        schedulestorage.renameSchedule(index, name);
    },

    _onClick: function(index) {
        schedules.setCurrentSchedule(undefined, index);
        ana.sevent('multischedule', 'switch', index);
    },

    _onDelete: function(index) {
        schedulestorage.deleteSchedule(index);
        ana.sevent('multischedule', 'delete', schedulestorage.numberOfSchedules());
    },

    _onCancelAdd: function() {
        this.setState({creating: false});
    },

    render: function() {
        var lis = [];
        var allSchedules = this.state.schedules;
        var curSchedule = schedules.getCurrentSchedule();
        if (allSchedules) {
            lis = allSchedules.map(function(schedule, index) {
                return <ScheduleLine name={schedule.name}
                                     color={schedule.color}
                                     isCurrent={curSchedule && curSchedule.uniqueId === schedule.uniqueId}
                                     editing={false}
                                     onSave={this._saveExistingSchedule.bind(null, index)}
                                     onClick={this._onClick.bind(null, index)}
                                     onDelete={this._onDelete.bind(null, index)}
                                     key={schedule.uniqueId} />;
            }, this);

            if (this.state.creating) {
                var nameAndColor = schedulestorage.getNewScheduleNameAndColor();
                lis.push(<ScheduleLine name={nameAndColor.name}
                                       color={nameAndColor.color}
                                       isCurrent={false}
                                       editing={true}
                                       onSave={this._saveNewSchedule}
                                       onCancel={this._onCancelAdd}
                                       key="new-edit" />);
            } else {
                lis.push(<li onClick={this._addSchedule} className="btnish" key="new">
                            <div className="schedule-logo add" />
                            <div className="schedule-listing-content">Add a Schedule</div>
                        </li>);
            }
        }

        return <div id="sidebar-inner" onMouseOver={this._onHover} onMouseOut={this._onOut}>
                    <h3>MY SCHEDULES</h3>
                    <ul className="schedule-listing">
                        {lis}

                    </ul>

        </div>;
    }
});

export default LeftBar;
