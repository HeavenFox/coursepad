/**
 * @jsx React.DOM
 */
var BasicInfo = require('./sidebar/BasicInfo.react.js');
var Basket = require('./sidebar/Basket.react.js');

var Sidebar = React.createClass({
    render: function() {
        return <div>
            <BasicInfo />
            <Basket />
        </div>
    }
});

module.exports = Sidebar;