import * as modal from '../../utils/modal';

var importexport : any = require('../../utils/importexport.js');


var ImportExport = React.createClass({
    _close: function() {
        modal.stop();
    },

    _save: function() {
        importexport.export();
    },

    _load: function() {
        var files = this.refs['load'].files;
        if (files.length === 0) {
            alert("You need to choose a file");
        } else {
            importexport.import(files[0]);
        }
    },

    render: function() {

        return <div className="modal-window-inner import-export">
            <h2>Import / Export Schedule</h2>
            <h3>Export Schedule</h3>
                <p>You can save your schedule to a file, in case browser data is cleared</p>
                <p><div className="btn btn-blue" onClick={this._save}>Save</div></p>
            <hr />
            <h3>Import Schedule</h3>
                <p>You can load your previously saved schedule.</p>
                <p><em>Warning:</em> this replaces any schedule you have right now</p>
                <div><input type="file" ref="load" /><div className="btn btn-blue" onClick={this._load}>Load</div></div>
            <div className="close-btn-container">
                <div className="close-btn" onClick={this._close}>Close</div>
            </div>
        </div>


        
    }
});

export default ImportExport;