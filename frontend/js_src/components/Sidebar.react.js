/**
 * @jsx React.DOM
 */
var BasicInfo = require('./sidebar/BasicInfo.react.js');
var Basket = require('./sidebar/Basket.react.js');
var Tools = require('./sidebar/Tools.react.js');
var Magic = require('./sidebar/Magic.react.js');


var Sidebar = React.createClass({
    render: function() {
        return <div>
            <BasicInfo />
            <Basket />
            <Tools />
        </div>
    }
});

module.exports = Sidebar;