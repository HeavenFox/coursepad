var IfLoginStatus = React.createClass({
    getInitialState: function() {
        return {loggedIn: true};
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        return nextState.loggedIn !== this.state.loggedIn;
    },

    render: function() {
        if (this.state.loggedIn) {
            return Array.isArray(this.props.children) ? this.props.children[0] : this.props.children;
        } else {
            return Array.isArray(this.props.children) ? (this.props.children[1] || null) : null;
        }

    },
});

module.exports = IfLoginStatus;