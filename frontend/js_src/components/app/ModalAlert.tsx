interface ModalAlertProps {
    title: string;
    content: string;
    btns: {[key: string]: string};
    btnClass: {[key: string]: string};
    allowCancel: boolean;
    onClick: Function;
}

var ModalAlert = React.createClass<ModalAlertProps, {}>({
    render() {
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

export default ModalAlert;
