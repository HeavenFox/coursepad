import CalendarElementMixin from './CalendarElementMixin.tsx';
import {CalendarElementMixinProps} from './CalendarElementMixin.tsx';

interface ConflictIndicatorProps extends CalendarElementMixinProps {
    key: any;
}

var ConflictIndicator = React.createClass<ConflictIndicatorProps, {}>({
    mixins : [CalendarElementMixin],

    render: function() {
        return <div className={'conflict-indicator ' + this.getClassName()} style={this.getLayoutStyle()}></div>;
    }
});

export default ConflictIndicator;