import EventEmitter from 'event-emitter';
import {int31 as randomInt31} from '../utils/rand.ts';
import * as endpoints from '../consts/endpoints.ts';
import user from './user.ts';
import * as ajax from '../utils/ajax.ts';

import schedules from './schedules.ts';
import localStore from '../persist/localStorage.js';
import * as color from '../utils/color.ts';

var currentStorage;

var store = EventEmitter({
    getStorage: function() {
        return currentStorage || null;
    },

    getStorageTerm: function() {
        return currentStorage && currentStorage.term;
    },

    setStorage: function(term) {
        if (this.getStorageTerm() !== term) {
            this._setStorage(term);
            return true;
        }
        return false;
    },

    _setStorage: function(term) {
        currentStorage = new ScheduleStorage(term);
        if (user.getCurrentUser()) {
            this.firstSync();
        }
    },

    firstSync: async function() {
        if (this.getStorage()) {
            var result = await this.getStorage().firstSync();
            if (result) {
                this._emitChange();
                this._emitListChange();
            }
        }
    },

    _emitChange: function() {
        this.emit('change', {
            term: this.getStorageTerm()
        });
    },

    _emitListChange: function() {
        this.emit('listchange');
    },

    getNewScheduleNameAndColor: function() {
        return this.getStorage().getNewScheduleNameAndColor.apply(this.getStorage(), arguments);
    },

    numberOfSchedules: function() {
        return this.getStorage().numberOfSchedules.apply(this.getStorage(), arguments);
    },

    renameSchedule: function() {
        this.getStorage().renameSchedule.apply(this.getStorage(), arguments);
        this.getStorage().persistAndDirtyStorage();
        this._emitListChange();
    },

    deleteSchedule: function() {
        this.getStorage().deleteSchedule.apply(this.getStorage(), arguments);
        this.getStorage().persistAndDirtyStorage();
        this._emitListChange();
    },

    addSchedule: function() {
        this.getStorage().addSchedule.apply(this.getStorage(), arguments);
        this.getStorage().persistAndDirtyStorage();
        this._emitListChange();
    },

    getAllSchedules: function() {
        return this.getStorage().getAllSchedules.apply(this.getStorage(), arguments);
    },

    deleteLocal: function() {
        var pattern = /^[a-z]{2}[0-9]{2}_(sync_status|schedules)$/;
        localStore.keys().forEach(function(key) {
            if (key.match(pattern)) {
                localStore.del(key);
            }
        });
        this._emitChange();
        this._emitListChange();
    },
});


user.on('loginstatuschange', async function(e) {
    closeSocket();
    var newUser = e.newUser;
    if (newUser) {
        try {
            await initSocket();
        } catch(e) {
            console.error('Cannot initialize WebSocket upon log in: ' + e);
        }

        store.firstSync();
    }
});

localStore.on('change', function(e) {
    var chunks = e.key.split('_', 2);
    if (chunks[1] === 'schedules') {
        if (chunks[0] === store.getStorageTerm()) {
            store._emitChange();
            store._emitListChange();
        }
    }
});

const WEBSOCKET_OPEN_TIMEOUT = 10*1000, WEBSOCKET_HEARTBEAT_INTERVAL = 60*1000;

const WEBSOCKET_RETRY_LIMIT = 5, WEBSOCKET_RETRY_TIMEOUT = 10 * 60 * 1000;

var webSocketPromise, socketSession, webSocket;
var heartbeatTimeout;
var socketKeepAlive;

var CONN_TIME_OUT_ERR = new Error('connection timeout');

function makeSocket(sessionId, clientId) {
    webSocket = null;
    return new Promise(function(resolve, reject) {
        var timeout = window.setTimeout(function() {
            reject(CONN_TIME_OUT_ERR);
        }, WEBSOCKET_OPEN_TIMEOUT);

        var ws = new WebSocket(endpoints.sync(sessionId, clientId));
        ws.onopen = function() {
            window.clearTimeout(timeout);
            webSocket = ws;
            socketKeepAlive = window.setTimeout(socketHeartbeat, WEBSOCKET_HEARTBEAT_INTERVAL);

            console.log('WebSocket initiated!');
            resolve(ws);
        };

        ws.onmessage = function(e) {
            if (e.data === 'PONG') {
                console.log('Received WebSocket Heartbeat');

                window.clearTimeout(heartbeatTimeout);
                return;
            }
            var reply = JSON.parse(e.data);
            if (reply['action'] === 'ack' || reply['action'] === 'conflict') {
                while (ackCallbacks.length > 0) {
                    var cb = ackCallbacks.pop();
                    cb(reply);
                }
            } else if (reply['action'] === 'update') {
                if (store.getStorage().term === reply['term']) {
                    store.getStorage().receive(reply);
                }
            }
        };

        ws.onerror = function() {
            reject(new Error('WebSocket OnError'));
        }
    });
}

function closeSocket() {
    if (socketKeepAlive) {
        window.clearTimeout(socketKeepAlive);
        socketKeepAlive = null;
    }

    if (webSocket) {
        webSocket.close();
    }

    webSocket = webSocketPromise = socketSession = null;
}

var NOT_LOGGED_IN_ERR = new Error('Not Logged In');

function initSocket() {
    console.log('Preparing to init new socket...')
    // Check current user
    if (!user.getCurrentUser()) {
        throw NOT_LOGGED_IN_ERR;
    }

    socketSession = user.getSession();

    console.assert(socketSession);

    console.log('Making new socket...')
    var clientId = localStore.get('client_id', randomInt31);

    webSocketPromise = makeSocket(socketSession, clientId);
    return webSocketPromise;
}

function isSocketHealthy() {
    return webSocket && webSocket.readyState === WebSocket.OPEN && user.getSession() === socketSession;
}

var websocketRetryRemaining = WEBSOCKET_RETRY_LIMIT, websocketLastTryTime = 0;

var ERR_BLACKOUT_PERIOD = new Error('Blackout');

async function getWebSocket() {
    if (websocketRetryRemaining <= 0) {
        if (Date.now() > websocketLastTryTime + WEBSOCKET_RETRY_TIMEOUT) {
            websocketRetryRemaining = WEBSOCKET_RETRY_LIMIT;
        } else {
            throw ERR_BLACKOUT_PERIOD;
        }
    }

    var timeoutCounter = 3;
    while (!isSocketHealthy()) {
        try {
            await initSocket();
        } catch (e) {
            if (e === CONN_TIME_OUT_ERR && timeoutCounter > 0) {
                timeoutCounter--;
            } else {
                websocketRetryRemaining--;
                websocketLastTryTime = Date.now()
                throw e;
            }
        }
    }

    return webSocket;
}

function socketHeartbeat() {
    if (!webSocket) {
        return;
    }

    console.log('Sending WebSocket Heartbeat');

    webSocket.send('PING');
    heartbeatTimeout = window.setTimeout(function() {
        console.log('WebSocket Heartbeat Timeout. Resetting...');
        closeSocket();
        initSocket();
    }, WEBSOCKET_OPEN_TIMEOUT);

    socketKeepAlive = window.setTimeout(socketHeartbeat, WEBSOCKET_HEARTBEAT_INTERVAL);
}

var ackCallbacks = [];

const SAVE_INTERVAL = 1000;

function ScheduleStorage(term) {
    this.term = term;
    this.timeout = null;
}

ScheduleStorage.prototype = EventEmitter({});

ScheduleStorage.prototype.loadSchedule = async function(schedule) {
    var stored = localStore.get(this.getStoreKey(), Array);
    if (stored[schedule.index] !== undefined) {
        return await schedule.deserialize(stored[schedule.index]);
    }
    return null;
}

ScheduleStorage.prototype.reloadSchedule = async function(schedule) {
    var stored = localStore.get(this.getStoreKey(), Array);
    var index = schedule.index;
    if ((!stored[index] || stored[index]['uniqueId'] !== schedule.uniqueId) && schedule.uniqueId !== -1) {
        for (index = 0; index < stored.length; index++) {
            if (stored[index]['uniqueId'] === schedule.uniqueId) {
                break;
            }
        }

        if (index === stored.length) {
            schedule.clear();
            return false;
        }

        schedule.index = index;
    }

    if (!stored[index]) {
        schedule.clear();
        return false;
    }
    return await schedule.deserialize(stored[index]);
};

ScheduleStorage.prototype.persistAndDirtySchedule = function(schedule) {
    var listChanged = (this.numberOfSchedules() === 0)

    var stored = localStore.get(this.getStoreKey(), Array);
    stored[schedule.index] = schedule.serialize();
    this.persistAndDirtyStorage();

    if (listChanged) {
        store._emitListChange();
    }
};

ScheduleStorage.prototype.persistAndDirtyStorage = function() {
    localStore.fsync(this.getStoreKey());

    if (this.inflight) {
        this.dirtySinceSync = true;
    } else {
        this.getSyncStatus()['dirty'] = true;
        this.persistSyncStatus();
    }

    if (user.getCurrentUser()) {
        this.schedulePublish();
    }
};

ScheduleStorage.prototype.getStoreKey = function() {
    return this.term + '_schedules';
};

ScheduleStorage.prototype.getSyncStatusKey = function() {
    return this.term + '_sync_status';
};

ScheduleStorage.prototype.serialize = function() {
    return localStore.get(this.getStoreKey());
};

ScheduleStorage.prototype.getSyncStatus = function() {
    return localStore.get(this.getSyncStatusKey(), {});
};

ScheduleStorage.prototype.persistSyncStatus = function() {
    return localStore.fsync(this.getSyncStatusKey());
};

ScheduleStorage.prototype.schedulePublish = function() {
    if (this.timeout) {
        window.clearTimeout(this.timeout);
    }

    var self = this;
    this.timeout = window.setTimeout(function() {
        self.timeout = null;
        self.maybePublish();
    }, SAVE_INTERVAL);
};

ScheduleStorage.prototype.maybePublish = function() {
    if (!this.inflight && this.getSyncStatus()['dirty']) {
        this.publish();
    }
};

ScheduleStorage.prototype.publish = async function() {
    var serialized = this.serialize();

    var syncStatus = this.getSyncStatus();

    var message = {
        'version' : syncStatus['version'] || 0,
        'term' : this.term,
        'schedule' : serialized
    };

    try {
        var socket = await getWebSocket();
    } catch(e) {
        console.log('Cancel Publication: WebSocket Error: ' + e);
        return;
    }
    socket.send(JSON.stringify(message));

    this.inflight = true;

    var self = this;
    ackCallbacks.push(function(data) {
        if (data['term'] === self.term) {
            self.inflight = false;
            var syncStatus = self.getSyncStatus();
            syncStatus['version'] = data['version'];
            syncStatus['dirty'] = !!self.dirtySinceSync;
            self.dirtySinceSync = false;
            self.persistSyncStatus();

            if (syncStatus['dirty']) {
                self.schedulePublish();
            }
        }
    });
}

const LOCAL_UPDATED = 1, REMOTE_NEED_UPDATE = 1 << 1;

/**
 * not very strict, use with caution!
 */
function arrayIdentical(array1, array2) {
    if (!array1 && !array2) {
        return true;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    var hash = Object.create(null);
    for (var i=0; i < array1.length; i++) {
        if (hash[array1[i]] === undefined) {
            hash[array1[i]] = 1;
        } else {
            hash[array1[i]]++;
        }
    }
    for (var i=0; i < array2.length; i++) {
        hash[array2[i]]--;
    }
    for (var k in hash) {
        if (hash[k] !== 0) {
            return false;
        }
    }

    return true;
}

function objectSetIdentical(hs1, hs2) {
    if (!hs1 && !hs2) {
        return true;
    }
    for (var k in hs1) {
        if (hs1[k] && !hs2[k]) {
            return false;
        }
    }
    for (var k in hs2) {
        if (hs2[k] && !hs1[k]) {
            return false;
        }
    }
    return true;
}

function objectIdentical(obj1, obj2) {
    if (!obj1 && !obj2) {
        return true;
    }
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
        return false;
    }
    for (var k in obj1) {
        if (obj1[k] !== obj2[k]) {
            return false;
        }
    }
    return true;
}

function scheduleContentIdentical(sch1, sch2) {
    return arrayIdentical(sch1['sections'], sch2['sections']) && arrayIdentical(sch1['basket'], sch2['basket']) && objectSetIdentical(sch1['hidden'], sch2['hidden']);
}

function mergeSchedules(curSchedule, remoteSchedule) {
    // When merging, prefer current.
    var result = curSchedule.slice(0);
    for (var i=0; i < remoteSchedule.length; i++) {
        var curRemote = remoteSchedule[i];
        var j=0;
        if (remoteSchedule[i]['uniqueId'] === undefined) {
            j = result.length;
        } else {
            for (j=0; j < result.length; j++) {
                if (result[j]['uniqueId'] === remoteSchedule[i]['uniqueId']) {
                    break;
                }
            }
        }

        if (j < result.length) {
            if (!scheduleContentIdentical(result[j], curRemote)) {
                // Insert remote one as a conflict copy
                curRemote['uniqueId'] = randomInt31();
                if (curRemote['name'] === result[j]['name']) {
                    curRemote['name'] += ' (Conflict)';
                }
                result.splice(j+1, 0, curRemote);
            }
        } else {
            result.push(curRemote);
        }
    }
    return result;
}



ScheduleStorage.prototype.reconcile = function(version, schedule) {
    var result = 0;
    var syncStatus = this.getSyncStatus();
    var localVersion = syncStatus['version'] || 0;
    if (version > localVersion) {
        // Server has a higher version, should update local
        result |= LOCAL_UPDATED;
        if (syncStatus['dirty']) {
            // Local is dirty, need merge
            localStore.set(this.getStoreKey(), mergeSchedules(
                localStore.get(this.getStoreKey()),
                schedule
            ));
            syncStatus['version'] = version;
            this.persistSyncStatus();

            result |= REMOTE_NEED_UPDATE;
        } else {
            // Local is clean
            localStore.set(this.getStoreKey(), schedule);
            syncStatus['version'] = version;
            this.persistSyncStatus();
        }

    } else if (version === localVersion) {
        // Version are the same, upload if dirty
        if (syncStatus['dirty']) {
            result |= REMOTE_NEED_UPDATE;
        }
    }

    return result;
}

ScheduleStorage.prototype.receive = function(data) {
    var result = this.reconcile(data['version'], data['schedule']);

    if (result & LOCAL_UPDATED) {
        store._emitChange();
        store._emitListChange();
    }
};

ScheduleStorage.prototype.getSerializedByUniqueId = function(uniqueId) {
    var schedules = localStore.get(this.getStoreKey(), Array);
    for (var i=0; i < schedules.length; i++) {
        if (schedules[i]['uniqueId'] === uniqueId) {
            return [i, schedules[i]];
        }
    }
    return null;
};

ScheduleStorage.prototype.firstSync = async function() {
    var curUser;
    if (curUser = user.getCurrentUser()) {
        // If owner changed, reset
        var syncStatus = this.getSyncStatus();
        if (syncStatus['owner'] !== curUser.id) {
            if (localStore.get(this.getStoreKey(), Array).length > 0) {
                syncStatus['dirty'] = true;
            }
            syncStatus['version'] = 0;
            syncStatus['owner'] = curUser.id;
            this.persistSyncStatus();
        }


        try {
            var data = await ajax.getJson(endpoints.getSchedule(this.term), {'headers' : user.signHeader()});
        } catch (e) {
            return false;
        }

        if (!data['version']) {
            this.schedulePublish();
            return false;
        }

        var result = this.reconcile(data['version'], data['schedule']);
        if (result & REMOTE_NEED_UPDATE) {
            this.schedulePublish();
        }

        return result & LOCAL_UPDATED;
    }

    return false;
};

ScheduleStorage.prototype.getNewScheduleNameAndColor = function() {
    var storageKey = this.term + '_schedules';
    var list = localStore.get(storageKey, Array);
    var nameHash = Object.create(null);
    var colorHash = Object.create(null);

    this.getAllSchedules().forEach(function(schedule) {
        nameHash[schedule.name] = true;
        colorHash[schedule.color] = true;
    });

    var name;
    var nameSn = 1;
    while (true) {
        name = 'Schedule (' + nameSn + ')';
        if (!nameHash[name]) {
            break;
        }
        nameSn++;
    }

    var scheduleColor;

    var colorDistance = 1/8;
    var currentHue = 0;
    while (true) {
        scheduleColor = color.hsvToHex(currentHue, 0.25, 0.54);
        if (!colorHash[scheduleColor]) {
            break;
        }
        currentHue += colorDistance;
        if (currentHue >= 1) {
            colorDistance /= 2;
            currentHue = colorDistance;
        }
    }

    return {name: name, color: scheduleColor};
};

ScheduleStorage.prototype._withStorageList = function(cb, thisArg) {
    if (thisArg === undefined) thisArg = null;
    var storageKey = this.term + '_schedules';
    var list = localStore.get(storageKey, Array);
    var fsync = function() {
        localStore.fsync(storageKey);
    };

    var result = cb.call(thisArg, list, fsync);


    return result;
};

ScheduleStorage.prototype.numberOfSchedules = function() {
    return this._withStorageList(function(list) {
        return list.length;
    });
};

ScheduleStorage.prototype.renameSchedule = function(index, name) {
    this._withStorageList(function(list, fsync) {
        list[index].name = name;
        fsync();
    });
};

ScheduleStorage.prototype.deleteSchedule = function(index) {
    this._withStorageList(function(list) {
        list.splice(index, 1);
    }, this);
};

ScheduleStorage.prototype.addSchedule = function(name, scheduleColor) {
    this._withStorageList(function(list, fsync) {
        list.push({
            color: scheduleColor,
            name: name,
            uniqueId: Math.floor(Math.random() * 0x7FFFFFFF)
        });
        fsync();
    });
};

ScheduleStorage.prototype.getAllSchedules = function() {
    return this._withStorageList(function(list) {
        return list.map(function(item, index) {
            return {
                color: item['color'],
                name: item['name'],
                uniqueId: item['uniqueId']
            };
        });
    });
};


export default store;