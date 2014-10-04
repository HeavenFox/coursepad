/**
 * @jsx React.DOM
 */
var BasicInfo = React.createClass({
    render: function() {
        var creditIsRange = this.state['credits'][0] == this.state['credits'][1];
        return <div>

                <p className={creditIsRange ? 'total-credit total-credit-range' : 'total-credit'}>
                    {creditIsRange ? this.state['credits'][0] + '-' + this.state['credits'][1] : this.state['credits'][0]}</p>
                <p className="total-credit-title">UNITS</p>
                <p className
            </div>
    }
});

module.exports = BasicInfo;