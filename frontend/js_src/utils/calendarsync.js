import saveAs from 'FileSaver.js';
import {getShortLocation} from '../consts/humanize.js';

export function toiCal(components) {
	let content = `BEGIN:VCALENDAR
PRODID:-//CoursePad.me//CoursePad.me//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;
	let t = num => num < 10 ? '0' + num : num.toString();
	let formatDateTime = rfc => {
		let date = new Date(rfc);
		return `${date.getFullYear()}${t(date.getMonth()+1)}${t(date.getDate())}T${t(date.getHours())}${t(date.getMinutes())}${t(date.getSeconds())}`;
	};
	toGoogleCalendar(components).forEach(event => {
		content += `BEGIN:VEVENT
STATUS:CONFIRMED
TRANSP:OPAQUE
SUMMARY:${event['summary']}
LOCATION:${event['location']}
DTSTART;TZID=${event['start']['timeZone']}:${formatDateTime(event['start']['dateTime'])}
DTEND;TZID=${event['end']['timeZone']}:${formatDateTime(event['end']['dateTime'])}
`
		event['recurrence'].forEach(r => {
			content += r;
			content += '\n';
		});

		content += 'END:VEVENT\n';
	});
	content += 'END:VCALENDAR\n';

	return content;
}


export function saveiCal(components, fn) {
	saveAs(new Blob([toiCal(components)], {type: 'text/calendar'}), fn);
}

// Convert class to several event representations
export function toGoogleCalendar(components) {
	const events = [];
	const timeRegex = /(\d+):(\d+)(A|P)M/;
	const dateRegex = /(\d+)\/(\d+)\/(\d+)/;

	const toRFC = (date, time) => {
		const dm = dateRegex.exec(date);
		const tm = timeRegex.exec(time);

		if (!dm || !tm) {
			return null;
		}

		return dm[3] + '-' + dm[1] + '-' + dm[2] + 'T' + (parseInt(tm[1], 10) + (tm[3] === 'P' ? 12 : 0)).toString() + ':' + tm[2] + ':00';
	};

	components.forEach(comp => {
		const course = comp.parent;
		let needSuffix = Object.keys(course.sections).length > 1;
		let suffix = needSuffix ? ' (' + comp.type + ')' : '';

		comp.meetings.forEach((meeting, idx) => {
			let summary = course.subject + ' ' + course.number + suffix;
			let timeZone = 'America/New_York';

			// represent the first occurence, so both use startDate
			let startTime = toRFC(meeting.startDate, meeting.startTime);
			let endTime = toRFC(meeting.startDate, meeting.endTime);
			if (!startTime || !endTime) {
				return;
			}
			let days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
			let meetingDays = '';
			for (let i = 0; i < 7; i++) {
				if (meeting.pattern & (1<<i)) {
					if (meetingDays.length > 0) {
						meetingDays += ',';
					}
					meetingDays += days[i];
				}
			}

			let endDateMatch = dateRegex.exec(meeting.endDate);
			let rrule = [];
			if (endDateMatch && meetingDays.length > 0) {
				let rulestring = 'RRULE:FREQ=DAILY;BYDAY=';
				rulestring += meetingDays;
				rulestring += ';UNTIL=';
				rulestring += endDateMatch[3];
				rulestring += endDateMatch[1];
				rulestring += endDateMatch[2];
				rrule = [rulestring];
			}

			events.push({
				'summary': summary,
				'location': getShortLocation(meeting.building, meeting.room),
				'start': {
					'dateTime': startTime,
					'timeZone': timeZone,

				},
				'end': {
					'dateTime': endTime,
					'timeZone': timeZone,
				},
				'recurrence': rrule,
				'extendedProperties': {
					'private': {
						'coursepad': '1',
						'coursepad.term': course.term,
						'coursepad.classid': comp.number.toString(),
					}
				}
			});
		});
	});
	return events;
}

export async function syncToGoogle(schedule) {
	await gapi.client.load('calendar', 'v3');

	let request = gapi.client.calendar.events.list({
		'calendarId': 'primary',

	});
}