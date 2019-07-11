export function timeStringToHour(s: string): number {
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

export function bitmaskToDay(bitmask: number): string {
    let result = "";
    let days = "MTWRFSU";
    for (let i = 0; i < 7; i++) {
        if (bitmask & (1<<i)) {
            result += days[i];
        }
    }
    return result;
};


const timeRegex = /(\d+):(\d+)(A|P)M/;
const dateRegex = /(\d+)\/(\d+)\/(\d+)/;

function addLeadingZero(num: number) {
    return num < 10 ? '0' + num : '' + num;
}

export function strToDateObject(str: string): Date {
    const dm = dateRegex.exec(str);
    if (!dm) return null;

    return new Date(+dm[3], +dm[1] - 1, +dm[2]);
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
