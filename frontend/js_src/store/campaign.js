import localStore from '../persist/localStorage';

export function hasRun(name) {
	return !!localStore.get('campaigns', {})[name];
}

export function markRun(name) {
	localStore.get('campaigns', {})[name] = true;
	localStore.fsync('campaigns');
}