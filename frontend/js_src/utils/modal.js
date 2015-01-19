var ModalAlert = React.createClass({
    render: function() {
        var closeBtn = null;
        if (this.props.allowCancel) {
            closeBtn = <span className="clickable modal-close" onClick={this.props.onClick.bind(null, null)}>&#x2716;</span>;
        }
        var btns = this.props.btns || {};
        var btnObjs = [];
        var btnCls = this.props.btnClass || {};
        for (var key in btns) {
            if (btns.hasOwnProperty(key)) {
                var cls = 'alert-btn btn'
                if (btnCls[key]) {
                    cls += (' btn-' + btnCls[key]);
                }
                btnObjs.push(<li className={cls} onClick={this.props.onClick.bind(null, key)}>{btns[key]}</li>);
            }

        }
        return <div className="modal-alert">
            <h2>{this.props.title} {closeBtn}</h2>
            <div className="modal-alert-content">{this.props.content}</div>
            <ul className="btn-row">{btnObjs}</ul>
        </div>

    }
});

var showing = false;

function show(component, priority) {
    if (showing) {
        stop();
    }

    showing = true;

    $('body').addClass('modal-open');
    $('.modal-container').removeClass('hidden');

    React.render(component, $('.modal-window').get(0));
}

function stop() {
    showing = false;
    $('body').removeClass('modal-open');
    $('.modal-container').addClass('hidden');
    React.unmountComponentAtNode($('.modal-window').get());
}

function alert(title, content, btns, btnClass, allowCancel) {
    return new Promise(function(resolve) {
        var close = function(d) {
            stop();
            resolve(d);
        };

        show(<ModalAlert title={title} content={content} btns={btns} btnClass={btnClass} allowCancel={allowCancel} onClick={close} />);
    });
}

module.exports = {
    show: show,
    stop: stop,
    alert: alert
}