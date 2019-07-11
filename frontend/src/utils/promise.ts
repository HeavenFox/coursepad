export function promisify(oldFunc, thisArg) {
	return new Promise((resolve, reject) => {
		oldFunc.call(thisArg, resolve);
	});
}
