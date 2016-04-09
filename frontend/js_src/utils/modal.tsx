import {show as showModal, hide as hideModal} from '../actions/modal';
import ModalAlert from '../components/app/ModalAlert';

export function show(component: JSX.Element) {
    $('body').addClass('modal-open');

    showModal.dispatch({content: component});
}

export function stop() {
    $('body').removeClass('modal-open');

    hideModal.dispatch({});
}

export function alert(title, content, btns, btnClass, allowCancel) {
    return new Promise(function(resolve) {
        var close = function(d) {
            stop();
            resolve(d);
        };

        show(<ModalAlert title={title} content={content} btns={btns} btnClass={btnClass} allowCancel={allowCancel} onClick={close} />);
    });
}
