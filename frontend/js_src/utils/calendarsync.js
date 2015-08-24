import saveAs from 'FileSaver.js';
import {getShortLocation} from '../consts/humanize.js';
import {authorize} from '../thirdparty/google.js';
import {promisify} from '../utils/promise.js'
import {toRFC} from '../utils/datetime.js'
import _ from 'lodash'

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

	const dateRegex = /(\d+)\/(\d+)\/(\d+)/;

	components.forEach(comp => {
		const course = comp.parent;
		let needSuffix = Object.keys(course.sections).length > 1;
		let suffix = needSuffix ? ' (' + comp.type + ')' : '';

		comp.meetings.forEach((meeting, idx) => {
			let summary = course.subject + ' ' + course.number + suffix;
			let timeZone = 'America/New_York';

			// represent the first occurence, so both use startDate
			let startDateMatch = dateRegex.exec(meeting.startDate);
			if (!startDateMatch) return;

			// Start date is the first day when the class meets
			let startDate = new Date(parseInt(startDateMatch[3], 10), parseInt(startDateMatch[1], 10) - 1, parseInt(startDateMatch[2], 10));
			if (meeting.pattern <= 0 || meeting.pattern >= (1<<7)) return;
			while (!((1 << ((startDate.getDay() + 6) % 7)) & meeting.pattern)) {
				startDate.setDate(startDate.getDate() + 1);
			}

			let startTime = toRFC(startDate, meeting.startTime);
			let endTime = toRFC(startDate, meeting.endTime);
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

async function syncEvents(components) {
	await gapi.client.load('calendar', 'v3');
	var request = gapi.client.calendar.events.list({
		'calendarId': 'primary',
	});
	let compsByTerm = _.groupBy(components, comp => comp.parent.term);
	_.forEach(compsByTerm, async function(comps, term) {
		let canonicalEvents = toGoogleCalendar(comps);
		let request = gapi.client.calendar.events.list({
			'calendarId': 'primary',
			'maxResults': 2500,
			'privateExtendedProperty': `coursepad.term=${term}`,
		});
		const response = await promisify(request.execute, request);
		console.log(response);

		const needDelete = [], needAdd = [], needUpdate = {};
		const getId = a => parseInt(a['extendedProperties']['private']['coursepad.classid'], 10);
		const comparator = (a, b) => getId(a) - getId(b);

		const serverEvents = response['items'];

		const serverEventsByClassId = _.groupBy(serverEvents, getId)
		const canonicalEventsByClassId = _.groupBy(canonicalEvents, getId)

		_.forEach(serverEventsByClassId, (events, classId) => {
			if (canonicalEventsByClassId.hasOwnProperty(classId)) {
				const canonical = canonicalEventsByClassId[classId];
				const server = events;

				let minLength = Math.min(canonical.length, server.length);
				for (let i=0; i < minLength; i++) {
					needUpdate[server[i]['id']] = canonical[i];
				}

				if (canonical.length > server.length) {
					for (let i = minLength; i < canonical.length; i++) {
						needAdd.push(canonical[i]);
					}
				} else {
					for (let i = minLength; i < server.length; i++) {
						needDelete.push(server[i]['id']);
					}
				}

			} else {
				events.forEach(e => {
					needDelete.push(e['id']);
				});
			}
		});

		_.forEach(canonicalEventsByClassId, (events, classId) => {
			if (!serverEventsByClassId.hasOwnProperty(classId)) {
				[].push.apply(needAdd, events);
			}
		});
		
		let batch = gapi.client.newBatch();
		needAdd.forEach(event => {
			batch.add(gapi.client.calendar.events.insert({
				'calendarId': 'primary'
			}, event));
		});

		needDelete.forEach(event => {
			batch.add(gapi.client.calendar.events.delete({
				'calendarId': 'primary',
				'eventId': event
			}));
		});

		_.forEach(needUpdate, (event, id) => {
			batch.add(gapi.client.calendar.events.patch({
				'calendarId': 'primary',
				'eventId': id
			}, event));
		})
		let result = await batch;
		console.log(result);
		
	})
}

export async function syncToGoogle(components) {
	await new Promise((resolve, reject) => {
		authorize({
			'scope': ['https://www.googleapis.com/auth/calendar'],
			'immediate': false,
		}, authResult => {
			if (authResult && !authResult.error) {
				resolve(null);
			} else {
				reject(authResult && authResult.error);
			}
		});
	});

	await syncEvents(components);
}