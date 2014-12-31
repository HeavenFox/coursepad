var BasicInfo = require('./sidebar/BasicInfo.react.js');
var Basket = require('./sidebar/Basket.react.js');
var Tools = require('./sidebar/Tools.react.js');
var Magic = require('./sidebar/Magic.react.js');
var Sharing = require('./sidebar/Sharing.react.js');
var IfLoginStatus = require('./meta/IfLoginStatus.react.js');

var Sidebar = React.createClass({
    render: function() {
        return <div>
            <BasicInfo />
            <Basket />
            <IfLoginStatus>
                <Sharing />
            </IfLoginStatus>
            <Magic />
            <Tools />
        </div>
    }
});

module.exports = Sidebar;