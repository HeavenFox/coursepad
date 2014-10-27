/**
 * @jsx React.DOM
 */
var magic = require('../../magic/magic.js');

var Priority = React.createClass({
    getInitialState: function() {
        return {val: this.props.bind[this.props.to]};
    },

    _onChange: function(e) {
        this.setState({val: +e.target.value});
        this.props.bind[this.props.to] = +e.target.value;
    },

    render: function() {
        return <li><label>{this.props.label}</label>

        <select value={this.state.val} onChange={this._onChange}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                </select></li>;
    }
});

var Magic = React.createClass({
    render: function() {
        var bindings = {lateStart: 3, earlyEnd: 3, noFriday: 3, lunchBreak: 3};
        return <div className="magic utilities-item">
        <h2>Magic</h2>
            <div className="utilities-content">
            <p className="description">Rate the Importance of... (1-5)</p>
            <ul>
                <Priority label="Get up late" bind={bindings} to="lateStart" />
                <Priority label="Go home early" bind={bindings} to="earlyEnd" />
                <Priority label="No Friday Class" bind={bindings} to="noFriday" />
                <Priority label="Have Lunch" bind={bindings} to="lunchBreak" />
            </ul>
            <p className="hint">Hint: marking everything 5 is the same as marking everything 1</p>
            <div className="clickable btn" onClick={function(){magic.makeSchedule(bindings);}}>Conjure a Schedule</div>
            <p className="hint">Note: Magic is in alpha. Generated schedule will not be saved automatically</p>
            </div>
        </div>;
    }
});

module.exports = Magic;