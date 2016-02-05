class Action<T> {
    private _name: string;
    private _listeners: ((payload: T) => void)[];
    
    constructor(name: string = undefined) {
        this._name = name;
        this._listeners = [];
    }
    
    register(callback: (payload: T) => void, thisArg: any = undefined): void {
        if (thisArg !== undefined) {
            callback = callback.bind(thisArg);
        }
        this._listeners.push(callback);
    }
    
    dispatch(payload: T): void {
        this._listeners.forEach((listener) => {
            listener(payload);
        });
    }
}

export function createAction<T>(name: string = undefined): Action<T> {
    return new Action<T>(name);
}