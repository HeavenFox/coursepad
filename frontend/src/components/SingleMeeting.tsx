import React from "react";
import CalendarElementMixin from "./CalendarElementMixin";
import { CalendarElementMixinProps } from "./CalendarElementMixin";
import schedules from "../store/schedules";
import createReactClass from "create-react-class";

const $ = window.jQuery;

// Make a function that can only be run once
function makeRunOnce(f) {
  var run = false;
  return {
    reset: function() {
      run = false;
    },
    run: function() {
      if (!run) {
        run = true;
        f();
      }
    }
  };
}

interface SingleMeetingProps extends CalendarElementMixinProps {
  /**
   * title: title of the course
   * location: location
   * time: time (string rep)
   * day: day of week (in 1-char string)
   * st_offset: start time (in offset)
   * length: length
   */
  owner: any;
  readOnly: boolean;
  meetings: any[];
  title: string;
  time: string;
  location: string;
  longLocation: string;
}

var SingleMeeting = createReactClass<SingleMeetingProps, {}>({
  longMeetingThreshold: 1.2,

  mixins: [CalendarElementMixin],

  componentDidMount: function() {
    if (this._mutable) {
      var self = this;

      $(this.refs["meeting"])
        .draggable({
          revert: "invalid",
          containment: this.props.owner.getMeetingContainer(),
          stop: function(event, ui) {
            ui.helper.css("left", "");
          }
        })
        .on("mousedown", function() {
          // Attach to body, because the mouse can be outside of the object when dropped
          // e.g. page scrolled
          $(document).one("mouseup", function() {
            self.props.dragStopHandler();
          });
          self.props.dragStartHandler();
        });
    }
  },

  render: function() {
    this._mutable =
      !this.props.readOnly &&
      !!schedules.getCurrentSchedule().getAlternateMeetings(this.props.meeting)
        .length;

    var classNames = "meeting " + this.getClassName();
    if (this._mutable) {
      classNames += " mutable";
    }
    if (this.props.length > this.longMeetingThreshold) {
      classNames += " meeting-long";
    }
    classNames += " " + this.props.color;

    var style = this.getLayoutStyle();
    var extra = {};
    if (this.props.longLocation) {
      extra["title"] = this.props.longLocation;
    }

    return (
      <div
        style={style}
        className={classNames}
        ref="meeting"
        data-nbr={this.props.nbr}
      >
        <p className="meeting-title">{this.props.title}</p>
        <p className="meeting-time">{this.props.time}</p>
        <p className="meeting-loc" {...extra}>
          {this.props.location}
        </p>
      </div>
    );
  }
});

export default SingleMeeting;
