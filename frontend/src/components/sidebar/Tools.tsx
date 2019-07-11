import React from "react";
import ClassNumbers from "../pagelets/ClassNumbers";
import ImportExport from "../pagelets/ImportExport";
import * as modal from "../../utils/modal";

class Tools extends React.Component<{}, {}> {
  _showClassNumbers() {
    modal.show(<ClassNumbers />);
  }

  _importExport() {
    modal.show(<ImportExport />);
  }

  render() {
    return (
      <div className="rightbar-simple-ul utilities-item">
        <h2>Tools</h2>
        <ul>
          <li>
            <a href="javascript:;" onClick={this._showClassNumbers}>
              Show Class Numbers
            </a>
          </li>
          <li>
            <a href="javascript:;" onClick={this._importExport}>
              Import / Export
            </a>
          </li>
        </ul>
      </div>
    );
  }
}

export default Tools;
