exports.timeStringToHour = function(s) {
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

exports.bitmaskToDay = function(bitmask) {
    var result = "";
    var days = "MTWRFSU";
    for (var i=0;i < 7;i++) {
        if (bitmask & (1<<i)) {
            result += days[i];
        }
    }
    return result;
};