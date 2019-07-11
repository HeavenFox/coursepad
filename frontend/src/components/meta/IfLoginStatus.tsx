import React from 'react';
import user from '../../store/user';

interface IfLoginStatusState {
    loggedIn: boolean;
}

export default class IfLoginStatus extends React.Component<React.Props<IfLoginStatus>, IfLoginStatusState> {
    state = {loggedIn: user.loggedIn()};

    _update() {
        this.setState({loggedIn: user.loggedIn()});
    }

    componentDidMount() {
        user.on('loginstatuschange', this._update);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextState.loggedIn !== this.state.loggedIn;
    }

    render() {
        if (this.state.loggedIn) {
            return (
                <div>{Array.isArray(this.props.children) ? this.props.children[0] : this.props.children}</div>
            );
        } else {
            return (
                <div>{Array.isArray(this.props.children) ? (this.props.children[1] || null) : null}</div>
            );
        }
    }
}
