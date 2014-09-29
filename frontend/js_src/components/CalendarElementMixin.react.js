var CalendarElementMixin = {
    unitHeight: 65,
    
    getLayoutStyle: function() {
        return {
            top: this.unitHeight * this.props['st_offset'],
            height: this.unitHeight * this.props['length']
        };
    }
};

module.exports = CalendarElementMixin;