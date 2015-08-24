export function timeStringToHour(s) {
    var result = s.match(/(\d+):(\d+) ?(.+)/);
    if (result) {
        var hr = parseInt(result[1], 10);
        var offset = hr + parseInt(result[2], 10) / 60;
        var ampm = result[3][0].toLowerCase();
        if (hr == 12 && ampm == 'a') {
            offset -= 12;
        } else if (hr != 12 && ampm == 'p') {
            offset += 12;
        }

        return offset;
    }
};

var bitmaskToDay = {
    "1": "M",
    "2": "T",
    "4": "W",
    "8": "R",
    "16": "F",
    "32": "S",
    "64": "U"
};

export function bitmaskToDay(bitmask) {
    var result = "";
    var days = "MTWRFSU";
    for (var i=0;i < 7;i++) {
        if (bitmask & (1<<i)) {
            result += days[i];
        }
    }
    return result;
};


const timeRegex = /(\d+):(\d+)(A|P)M/;
const dateRegex = /(\d+)\/(\d+)\/(\d+)/;

function addLeadingZero(num) {
    return num < 10 ? '0' + num : '' + num;
}

export function toRFC(date, time) {
    let year, month, dom;
    if (date instanceof Date) {
        year = date.getFullYear();
        month = addLeadingZero(date.getMonth() + 1);
        dom = addLeadingZero(date.getDate());
    } else {
        const dm = dateRegex.exec(date);
        if (!dm) return null;

        year = dm[3];
        month = dm[1];
        dom = dm[2];
    }

    const tm = timeRegex.exec(time);
    if (!tm) {
        return null;
    }

    let hr = parseInt(tm[1], 10);
    let offset = tm[3] === 'P' ? 12 : 0;
    if (hr === 12) {
        offset -= 12;
    }
    hr += offset;
    let hrString = addLeadingZero(hr);

    return `${year}-${month}-${dom}T${hrString}:${tm[2]}:00`;
}