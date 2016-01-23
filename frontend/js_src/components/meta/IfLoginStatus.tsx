import user from '../../store/user.ts';

var IfLoginStatus = React.createClass({
    getInitialState: function() {
        return {loggedIn: user.loggedIn()};
    },

    _update: function() {
        this.setState({loggedIn: user.loggedIn()});
    },

    componentDidMount: function() {
        user.on('loginstatuschange', this._update);
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

export default IfLoginStatus;