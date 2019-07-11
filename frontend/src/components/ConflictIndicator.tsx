import React from "react";
import CalendarElementMixin from "./CalendarElementMixin";
import { CalendarElementMixinProps } from "./CalendarElementMixin";
import createReactClass from "create-react-class";

interface ConflictIndicatorProps extends CalendarElementMixinProps {
  key: any;
}

var ConflictIndicator = createReactClass<ConflictIndicatorProps, {}>({
  mixins: [CalendarElementMixin],

  render: function() {
    return (
      <div
        className={"conflict-indicator " + this.getClassName()}
        style={this.getLayoutStyle()}
      />
    );
  }
});

export default ConflictIndicator;
