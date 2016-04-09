import EventEmitter from 'eventemitter3';
import {show as showModal, hide as hideModal} from '../actions/modal';

class ModalStore extends EventEmitter {
    element: JSX.Element;
    private showing: boolean;

    constructor() {
        super();
        this.showing = false;
        this.registerListeners();
    }

    private registerListeners() {
        showModal.register(payload => {
            this.showing = true;
            this.element = payload.content;
            this.emit('change');
        });

        hideModal.register(payload => {
            if (this.showing) {
                this.showing = false;
                this.element = null;
                this.emit('change');
            }
        });
    }
}

let store = new ModalStore();

export default store;
