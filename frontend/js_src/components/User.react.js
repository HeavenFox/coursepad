var Drop = require('drop');

var user = require('../store/user.js');

var UserMenu = React.createClass({
    _fbLogin: function() {
        user.triggerLogin('fb');
    },

    render: function() {
        return <div className="menu"><ul>
            <li className="btnish" onClick={this._fbLogin}>Login with Facebook</li>
        </ul></div>;

    }
});

var User = React.createClass({
    getInitialState: function() {
        return {user: null};
    },

    _onUserChange: function() {
        this.setState({user: user.getCurrentUser()});
    },

    componentDidMount: function() {
        user.on('loginstatuschange', this._onUserChange);
        var contentDescriptor = <UserMenu clickHandler={this._click} />;
        this.menu = new Drop({
            target: this.refs['trigger'].getDOMNode(),
            content: contentDescriptor,
            position: 'bottom center',
            openOn: 'click',
            constrainToWindow: true,
            tetherOptions: {
                constraints: [
                    {
                        to: 'scrollParent',
                        pin: true
                    }
                ]
            }
        });
    },

    render: function() {
        var userName = 'Guest';
        if (this.state.user) {
            userName = this.state.user.name;
        }
        var profilePicture = {};
        if (this.state.user && this.state.user.profilePicture) {
            profilePicture['backgroundImage'] = 'url(' + this.state.user.profilePicture + ')';
        }
        return <div className="current-user-inner"><span ref="trigger" className="btnish">
            <div className="topbar-user-icon" style={profilePicture} />
            {userName + ' \u25BE'}</span></div>
    }
});

module.exports = User;