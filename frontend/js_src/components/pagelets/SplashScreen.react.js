/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');

var user = require('../../store/user.js');
var campaign = require('../../store/campaign.js');

var ana = require('../../analytics/analytics.ts');

var LoginWindow = React.createClass({
    getInitialState: function() {
        return {confirming: false};
    },

    _donotsignin: function() {
        this.setState({confirming: true});
        ana.sevent('splash', 'donotsignin');
    },

    _useGuest: function() {
        this.props.onDone();
        ana.sevent('splash', 'guest');
    },

    _changeplan: function() {
        this.setState({confirming: false});
        ana.sevent('splash', 'change_mind');
    },

    _loginwithfb: function() {
        user.triggerLogin('fb');
        ana.sevent('splash', 'login', 'fb');
    },

    render: function() {
        if (this.state.confirming) {
            return <div className="start-using-btn-container">
                    <h3>Are you sure?</h3>
                    <p>Without signing in, you cannot share your schedule or save your schedules to your account.</p>
                    <p className="linkish" onClick={this._changeplan} key="goback">Go Back</p>
                    <p className="linkish" onClick={this._useGuest} key="continue">Use Without Signing In</p>
                </div>
        } else {
            return <div className="start-using-btn-container">
                    <h3>Sign in</h3>
                    <div className="btn loginwithfb" onClick={this._loginwithfb}>Login with Facebook</div>
                    <p className="promise">We never sneak posts on your timeline or spam your friends</p>
                    <p className="linkish" onClick={this._donotsignin} key="nosignin">Do not want to sign in?</p>
            </div>
        }
    }
});

var SplashScreen = React.createClass({
    componentDidMount: function() {
        user.on('loginstatuschange', this._onUserChange);
        ana.sevent('splash', 'show');
    },

    componentWillUnmount: function() {
        user.off('loginstatuschange', this._onUserChange);
    },

    _onUserChange: function(e) {
        if (e.newUser) {
            this._close();
        }
    },

    _close: function() {
        modal.stop();
        campaign.markRun('welcome');
        campaign.markRun('welcome_v2');
    },

    _migrate: function() {
        ana.sevent('splash', 'migrate');
    },

    render: function() {
        return <div className="splash-screen">
            <div className="splash-screen-header"></div>
            <div className="splash-screen-inner">
            <h2>Welcome to CoursePad.me</h2>
            <p className="headline">CoursePad.me is the best way to choose your classes and create your schedule at Cornell.</p>
            <div className="splash-screen-container">
            <div className="splash-screen-item-container">
                <div className="splash-screen-item">
                    <div className="splash-screen-img splash-screen-cloud-img" />
                    <p><em>Your Schedule, Everywhere</em> Now, your schedules are automatically saved to your account and synchronized across your devices.</p>
                </div>
                <div className="splash-screen-item">
                    <div className="splash-screen-img splash-screen-sharing-img" />
                    <p><em>Sharing</em> Now you can take a snapshot of your schedule and send the link to a friend, or share it on your favorite social network.</p>
                </div>
                <div className="splash-screen-item">
                    <div className="splash-screen-img splash-screen-magic-img" />
                    <p><em>Auto-Schedule</em> Miss Schedulizer? Add the courses in your mind, and let CoursePad.me arrange the time slots, tailored for your taste.</p>
                </div>
                <div className="clearboth" />
            </div>
            <LoginWindow onDone={this._close} />
            <div className="clearboth" />
            </div>
            </div>
        </div>
    }
});

module.exports = SplashScreen;