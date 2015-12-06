var registry = [];

export function reg(pattern, action, init) {
    registry.push({
        pattern: pattern,
        action: action,
        init: init
    });
};

export function init() {
    var path = window.location.pathname;
    for (var i=0; i < registry.length; i++) {
        var matches = registry[i].pattern.exec(path);
        if (matches) {
            matches.shift();
            var initResult;

            if (registry[i].init) {
                initResult = registry[i].init.apply(null, matches);
            }

            if (registry[i].action) {
                if (initResult && initResult.then) {
                    initResult.then(function() {
                        registry[i].action.apply(null, matches);
                    });
                } else {
                    registry[i].action.apply(null, matches);
                }
            }

            break;
        }
    }
}

export function changePath(newPath) {
    if (window.location.pathname !== newPath) {
        window.history.pushState(null, "", newPath);
    }
}

window.onpopstate = function() {
    var path = window.location.pathname;
    for (var i=0; i < registry.length; i++) {
        var matches = registry[i].pattern.exec(path);
        if (matches) {
            matches.shift();

            if (registry[i].action) {
                registry[i].action.apply(null, matches);
            }

            break;
        }
    }
};