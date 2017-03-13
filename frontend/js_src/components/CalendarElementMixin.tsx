import React from 'react';

var CalendarElementMixin = {
    unitHeight: 65,

    getLayoutStyle: function() {
        return {
            top: this.unitHeight * this.props.st_offset,
            height: this.unitHeight * this.props.length
        };
    },

    getClassName: function() {
        return 'calele calele-' + this.props.day.toLowerCase();
    }
};

export interface CalendarElementMixinProps extends React.Props<any> {
    st_offset: number;
    length: number;
    day: string;
}

export default CalendarElementMixin;
