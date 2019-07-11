import React from "react";

interface ModalAlertProps {
  title: string;
  content: string;
  btns: { [key: string]: string };
  btnClass: { [key: string]: string };
  allowCancel: boolean;
  onClick: Function;
}

const ModalAlert: React.FC<ModalAlertProps> = props => {
  var closeBtn = null;
  if (props.allowCancel) {
    closeBtn = (
      <span
        className="clickable modal-close"
        onClick={props.onClick.bind(null, null)}
      >
        &#x2716;
      </span>
    );
  }
  var btns = props.btns || {};
  var btnObjs = [];
  var btnCls = props.btnClass || {};
  for (var key in btns) {
    if (btns.hasOwnProperty(key)) {
      var cls = "alert-btn btn";
      if (btnCls[key]) {
        cls += " btn-" + btnCls[key];
      }
      btnObjs.push(
        <li className={cls} onClick={props.onClick.bind(null, key)}>
          {btns[key]}
        </li>
      );
    }
  }
  return (
    <div className="modal-alert">
      <h2>
        {props.title} {closeBtn}
      </h2>
      <div className="modal-alert-content">{props.content}</div>
      <ul className="btn-row">{btnObjs}</ul>
    </div>
  );
};

export default ModalAlert;
