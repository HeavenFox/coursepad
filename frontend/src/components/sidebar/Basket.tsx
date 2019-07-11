import React from "react";
import schedules from "../../store/schedules";
import { Schedule, MutableSchedule } from "../../model/schedules";
import { Course, CourseComponent, Cluster } from "../../model/course";

import * as ana from "../../analytics/analytics";
import createReactClass from "create-react-class";

import Drop from "tether-drop";

interface SelectionIndicatorProps {
  selected: boolean;
  action: React.EventHandler<any>;
}

var SelectionIndicator: React.FC<SelectionIndicatorProps> = props => {
  return (
    <div
      className={
        "selected-indicator" +
        (props["selected"] ? " selected" : "") +
        (props.action && !props["selected"] ? " selectable" : "")
      }
      onClick={props["selected"] ? undefined : props.action}
    >
      {" "}
    </div>
  );
};

function withMutableSchedule(
  schedule: Schedule,
  action: (s: MutableSchedule) => void
) {
  if (schedule instanceof MutableSchedule) {
    action(schedule);
  } else {
    console.warn("Trying to mutate immutable schedule");
  }
}

interface CourseItemProps {
  key: any;

  color: string;
  cluster: Cluster;
  hidden: boolean;
  selectedCourses: { [id: number]: boolean };
  selectedSections: { [id: number]: boolean };

  onChangeSection: (id: number) => void;
  onChangeCourse: (course: Course) => void;
  onToggleVisibility: (num: string) => void;
  onDelete: (num: string) => void;
}

interface CourseItemState {
  expanded?: boolean;
  menuOpen?: boolean;
}

class CourseItem extends React.Component<CourseItemProps, CourseItemState> {
  drop: any;

  constructor(props: CourseItemProps) {
    super(props);
    this.state = { expanded: false, menuOpen: false };
  }

  _toggleExpansion = () => {
    this.setState({ expanded: !this.state.expanded });

    ana.sevent("basket", "toggle_expansion", this.props.cluster[0].getNumber());
  };

  _toggleMenu = (courseNumber, e) => {
    this.setState({ menuOpen: !this.state.menuOpen });

    if (!this.drop) {
      var menu = document.createElement("div");
      menu.className = "menu";
      var ul = document.createElement("ul");
      menu.appendChild(ul);

      var li = document.createElement("li");
      li.className = "clickable menuitem";
      li.innerHTML = "Delete";
      li.addEventListener("click", e => {
        this.drop.close();
        this.props.onDelete(courseNumber);
      });

      ul.appendChild(li);

      this.drop = new Drop({
        target: e.target,
        remove: true,
        position: "bottom right",
        content: menu,
        constrainToWindow: true,
        openOn: "click",
        tetherOptions: {
          constraints: [
            {
              to: "scrollParent",
              pin: true
            }
          ]
        }
      });

      this.drop.open();
    }
  };

  componentWillUnmount() {
    if (this.drop) {
      this.drop.destroy();
      this.drop = null;
    }
  }

  render() {
    let cluster = this.props.cluster;
    let selectedCourses = this.props.selectedCourses;
    let selectedSections = this.props.selectedSections;

    let number = cluster[0].getNumber();

    let className = this.props.color;

    let clusterVisible = !this.props.hidden;

    if (!clusterVisible) {
      className += " invisible";
    }

    let listOfSections = (sections: CourseComponent[]) => {
      return sections.map(
        section => (
          <div className="content level-2" key={"S" + section.number}>
            <SelectionIndicator
              selected={selectedSections[section.number]}
              action={this.props.onChangeSection.bind(null, section.number)}
            />
            {section.type + " " + section.sec}
          </div>
        ),
        this
      );
    };

    let clusterItems: JSX.Element[];
    if (this.state.expanded) {
      if (cluster.length === 1) {
        var sections = cluster[0].getAllSections();
        clusterItems = listOfSections(sections);
      } else {
        clusterItems = cluster.map(course => {
          var sections = course.getAllSections();
          var sectionsDom = null;
          if (sections.length > 1) {
            sectionsDom = listOfSections(sections);
          }
          return (
            <div className="content level-2" key={"C" + course.id}>
              <SelectionIndicator
                selected={selectedCourses[course.id]}
                action={this.props.onChangeCourse.bind(null, course)}
              />
              {course.subject + " " + course.number}
              {sectionsDom}
            </div>
          );
        });
      }
    }

    var courseTitle = number + ": " + cluster[0].title;

    return (
      <div className={"basket-item " + className}>
        <div className="content">
          <div className="content-buttons">
            <div
              role="button"
              className="btn menu-btn"
              onClick={this._toggleMenu.bind(null, number)}
            />
            <div
              role="button"
              className={
                "btn visibility-btn" + (clusterVisible ? "" : " closed")
              }
              onClick={this.props.onToggleVisibility.bind(null, number)}
            />
            <div
              role="button"
              className={
                "btn expand-btn" + (this.state.expanded ? " expanded" : "")
              }
              onClick={this._toggleExpansion}
            />
          </div>
          <div className="content-title" title={courseTitle}>
            {courseTitle}
          </div>
        </div>
        {clusterItems}
      </div>
    );
  }
}

var Basket = createReactClass({
  componentWillMount: function() {
    schedules.on("readystatechange", this._onReadyStateChange);
    schedules.on("change", this._update);
  },
  componentWillUnmount: function() {
    schedules.off("readystatechange", this._onReadyStateChange);
    schedules.off("change", this._update);
  },

  _onReadyStateChange: function() {
    if (schedules.ready) {
      this._update();
    } else {
      this.setState(this.getInitialState());
    }
  },

  _update: function() {
    this.setState({
      clusters: schedules.getCurrentSchedule().basket,
      sections: schedules.getCurrentSchedule().sections,
      hidden: schedules.getCurrentSchedule().hidden
    });
  },

  getInitialState: function() {
    return { clusters: [], sections: [], hidden: {}, expansion: {} };
  },

  _toggleVisibility: function(courseNumber) {
    withMutableSchedule(schedules.getCurrentSchedule(), schedule => {
      schedule.toggleVisibility(courseNumber);
    });
  },

  _deleteCourse: function(courseNumber) {
    withMutableSchedule(schedules.getCurrentSchedule(), schedule => {
      schedule.removeCourseByNumber(courseNumber);
    });
  },

  _changeSectionTo: function(sectionId) {
    withMutableSchedule(schedules.getCurrentSchedule(), schedule => {
      schedule.changeSection(sectionId);
    });

    ana.sevent("course", "change_section_basket_dot", sectionId);
  },

  _changeCourseTo: function(course) {
    withMutableSchedule(schedules.getCurrentSchedule(), schedule => {
      schedule.changeCourse(course);
    });

    ana.sevent("course", "change_course_basket_dot", course);
  },

  render: function() {
    var self = this;
    var clusters = null;
    let currentSchedule = schedules.getCurrentSchedule();
    if (currentSchedule) {
      let selectedSections = currentSchedule.getSelectedSectionIdsHash();
      let selectedCourses = currentSchedule.getSelectedCourseIdsHash();

      clusters = (this.state.clusters as Cluster[]).map(cluster => {
        let cNumber = cluster[0].getNumber();
        let color = currentSchedule.getColorForCourse(
          cluster[0].subject,
          cluster[0].number
        );
        return (
          <CourseItem
            key={cNumber}
            color={color}
            cluster={cluster}
            hidden={this.state.hidden[cNumber]}
            selectedCourses={selectedCourses}
            selectedSections={selectedSections}
            onChangeSection={this._changeSectionTo}
            onToggleVisibility={this._toggleVisibility}
            onDelete={this._deleteCourse}
            onChangeCourse={this._changeCourseTo}
          />
        );
      }, this);
    }

    return (
      <div className="basket utilities-item">
        <h2>Basket</h2>
        {clusters}
      </div>
    );
  }
});

export default Basket;
