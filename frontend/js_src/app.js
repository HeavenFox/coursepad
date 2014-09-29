var Calendar = require('./components/Calendar.react.js');

var schedules = require('./store/schedules.js');

var flux = require('flux');

var curCalendar = Calendar();

React.renderComponent(curCalendar, document.getElementById('calendar'));

schedules.getCurrentSchedule();