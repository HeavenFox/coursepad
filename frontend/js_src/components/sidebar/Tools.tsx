import ClassNumbers from '../pagelets/ClassNumbers.tsx';
import ImportExport from '../pagelets/ImportExport.tsx';
import * as modal from '../../utils/modal';

var Tools = React.createClass({
    _showClassNumbers: function() {
        modal.show(<ClassNumbers />);
    },

    _importExport: function() {
        modal.show(<ImportExport />);
    },

    render: function() {
        return <div className="rightbar-simple-ul utilities-item">
        <h2>Tools</h2>
            <ul>
                <li><a href="javascript:;" onClick={this._showClassNumbers}>Show Class Numbers</a></li>
                <li><a href="javascript:;" onClick={this._importExport}>Import / Export</a></li>
            </ul>
        </div>;
    }
});

export default Tools;
