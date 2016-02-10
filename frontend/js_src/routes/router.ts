export abstract class RoutingRule {
    pattern: RegExp;
    
    init(...matches): (void|Promise<void>) {
        return;
    }
    
    push(...matches): (void|Promise<void>) {
        return;
    }
    
    pop(): (void|Promise<void>) {
        return;
    }
}
var registry: RoutingRule[] = [];

let current: RoutingRule = null;

export function register(route: RoutingRule): void {
    registry.push(route);
}

export function route() {
    var path = window.location.pathname;
    for (var i=0; i < registry.length; i++) {
        var matches = registry[i].pattern.exec(path);
        if (matches) {
            matches.shift();
            var initResult = registry[i].init(...matches);

            if (initResult instanceof Promise) {
                initResult.then(() => {
                    registry[i].push(...matches);
                });
            } else {
                registry[i].push(...matches);
            }
            
            current = registry[i];
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
            if (current) current.pop();
            registry[i].push(...matches);
            current = registry[i];
            break;
        }
    }
};