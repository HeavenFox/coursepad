import React from "react";
import magic from "../../store/magic";
import schedules from "../../store/schedules";
import { MutableSchedule } from "../../model/schedules";
import { sevent } from "../../analytics/analytics";
import createReactClass from "create-react-class";

interface PriorityProps {
  label: string;
  bind: any;
  to: string;
}

var Priority = createReactClass<PriorityProps, any>({
  getInitialState: function() {
    return { val: this.props.bind[this.props.to] };
  },

  _onChange: function(e) {
    this.setState({ val: +e.target.value });
    this.props.bind[this.props.to] = +e.target.value;
  },

  render: function() {
    return (
      <li>
        <label>{this.props.label}</label>

        <select value={this.state.val} onChange={this._onChange}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </li>
    );
  }
});

var bindings = { lateStart: 3, earlyEnd: 3, noFriday: 3, lunchBreak: 3 };

const STATE_READY = 0,
  STATE_THINKING = 1,
  STATE_DONE = 2,
  STATE_NO_VALID = 3;
const STATE_SAVED = 4,
  STATE_REVERTED = 5;

var Magic = createReactClass({
  getInitialState: function() {
    return {
      show: false,
      collapsed: true,
      state: STATE_READY
    };
  },

  componentDidMount: function() {
    schedules.on("change", this._scheduleChange);
    schedules.on("readystatechange", this._extScheduleChange);
    magic.on("change", this._magicChange);
  },

  componentWillUnmount: function() {
    schedules.off("change", this._scheduleChange);
    schedules.off("readystatechange", this._extScheduleChange);
    magic.off("change", this._magicChange);
  },

  _magicChange: function(e) {
    if (e.noValid) {
      this.setState({ state: STATE_NO_VALID });
    }
  },

  _scheduleChange: function(e) {
    if (e) {
      if (e.by === "magic-revert") {
        this.setState({ state: STATE_REVERTED });
      } else if (e.by === "magic-new") {
        this.setState({ state: STATE_DONE });
      } else {
        this._extScheduleChange();
      }
    } else {
      this._extScheduleChange();
    }
  },

  _extScheduleChange: function() {
    if (
      schedules.ready &&
      schedules.getCurrentSchedule() instanceof MutableSchedule
    ) {
      this.setState({
        show: true,
        state: STATE_READY
      });
    } else {
      this.setState({
        show: false
      });
    }
  },

  _save: function() {
    magic.save();
    this.setState({ state: STATE_SAVED });
    sevent("magic", "save");
  },

  _cancel: function() {
    magic.cancel();
    this.setState({ state: STATE_READY });
  },

  _next: function() {
    this.setState({ state: STATE_THINKING });
    magic.next();
    sevent("magic", "another");
  },

  _revert: function() {
    magic.revert();
    this.setState({ state: STATE_REVERTED });
    sevent("magic", "revert");
  },

  _goBack: function() {
    this.setState({ state: STATE_READY });
  },

  _toggleCollapse: function() {
    this.setState({ collapsed: !this.state.collapsed });
  },

  _scheduleMade: function(schedule) {
    this.setState({ state: STATE_DONE });
  },

  _makeSchedule: function() {
    this.setState({ state: STATE_THINKING });
    var curSchedule = schedules.getCurrentSchedule();
    magic.makeSchedule(curSchedule, bindings);
    sevent("magic", "makeschedule");
  },

  render: function() {
    // if (!this.state.show) {
    //     return null;
    // }
    var content;

    switch (this.state.state) {
      case STATE_READY:
        content = (
          <div className="utilities-content">
            <p className="linkish" onClick={this._makeSchedule}>
              Generate a Schedule
            </p>
            <p className="linkish side" onClick={this._toggleCollapse}>
              {(this.state.collapsed ? "" : "- ") + "Adjust Preferences"}
            </p>
            <div className={this.state.collapsed ? "hidden" : ""}>
              <p className="description">
                Rate the following:
                <br />
                <small>
                  5: Very Important
                  <br />
                  1: Not Important
                </small>
              </p>
              <ul>
                <Priority label="Get up late" bind={bindings} to="lateStart" />
                <Priority label="Go home early" bind={bindings} to="earlyEnd" />
                <Priority
                  label="No Friday Class"
                  bind={bindings}
                  to="noFriday"
                />
                <Priority label="Have Lunch" bind={bindings} to="lunchBreak" />
              </ul>
              <p className="hint">
                Hint: marking everything 5 is the same as marking everything 1
              </p>
            </div>
          </div>
        );
        break;
      case STATE_THINKING:
        content = (
          <div className="utilities-content">
            <p>Thinking...</p>
            <p className="side" onClick={this._cancel}>
              Cancel
            </p>
          </div>
        );
        break;
      case STATE_DONE:
        content = (
          <div className="utilities-content">
            <p>We found a good schedule</p>
            <p className="side linkish" onClick={this._next}>
              Think Another
            </p>
            <p className="side linkish" onClick={this._save}>
              Save
            </p>
            <p className="side linkish" onClick={this._revert}>
              Revert
            </p>
          </div>
        );
        break;
      case STATE_NO_VALID:
        content = (
          <div className="utilities-content">
            <p>Cannot Find a Schedule</p>
            <p>
              Likely the courses you have chosen conflict with each other. Try
              removing some.
            </p>
          </div>
        );

        break;
      case STATE_SAVED:
        content = (
          <div className="utilities-content">
            <p>Schedule Saved</p>
            <p className="side linkish" onClick={this._goBack}>
              Back
            </p>
          </div>
        );
        break;
      case STATE_REVERTED:
        content = (
          <div className="utilities-content">
            <p>Schedule Reverted</p>
            <p className="side linkish" onClick={this._goBack}>
              Back
            </p>
          </div>
        );
        break;
    }

    return (
      <div className="magic utilities-item">
        <h2>Auto-Schedule</h2>
        {content}
      </div>
    );
  }
});

export default Magic;
