var Drop = require('drop');

var user = require('../store/user.js');

var UserInfoBox = React.createClass({
    render: function() {
        var style = this.props.profilePicture ? {'backgroundImage' : 'url("' + this.props.profilePicture.replace('"', '\\"') + '")'} : {};
        return <div className="user-info" style={style}>
                    <div className="user-avatar" />
                    <div className="user-name">{this.props.name ? this.props.name : 'Guest'}</div>
                </div>;
    }
})

var UserMenu = React.createClass({
    _fbLogin: function() {
        user.triggerLogin('fb');
    },

    getInitialState: function() {
        return {};
    },

    _toggleEmail: function() {
        this.setState({pane: "two"});
    },

    _emailLogin: function(e) {
        e.preventDefault();
        var elements = e.target.elements;
        user.emailLogin(elements['email'].value, elements['password'].value);
    },

    render: function() {
        var className = "user-menu guest";
        if (this.state.pane) {
            className += (" " + this.state.pane);
        }
        return <div className={className}>
            <div className="user-options">
                <UserInfoBox />
                <hr />

                <p className="linkish" onClick={this._fbLogin}>Login with Facebook</p>
                <p className="linkish" onClick={this._toggleEmail}>Login with Email</p>
                <hr />
                <p className="linkish">Register with Email</p>
            </div>
            <div className="user-loginform">
                <div className="user-loginform-inner">
                <p>Login with Email</p>
                <form onSubmit={this._emailLogin}>
                <label>Email
                    <input name="email" type="email" placeholder="e.g. admin@coursepad.me" />
                </label>
                <label>Password
                    <input name="password" type="password" />
                </label>
                <input type="submit" value="Login" />
                </form>
                </div>
            </div>
        </div>;

    }
});

var User = React.createClass({
    getInitialState: function() {
        return {user: user.getCurrentUser()};
    },

    _onUserChange: function() {
        this.setState({user: user.getCurrentUser()});
    },

    _click: function() {
        this.menu.close();
    },

    componentDidMount: function() {
        user.on('loginstatuschange', this._onUserChange);
        var contentDescriptor = <div><UserMenu clickHandler={this._click} /></div>;
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

    componentWillUnmount: function() {
        user.off('loginstatuschange', this._onUserChange);
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