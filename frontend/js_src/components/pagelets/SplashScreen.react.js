/**
 * @jsx React.DOM
 */
var modal = require('../../utils/modal.js');
var localStore = require('../../persist/localStorage.js');

var user = require('../../store/user.js');
var campaign = require('../../store/campaign.js');

var LoginWindow = React.createClass({
    getInitialState: function() {
        return {confirming: false};
    },

    _donotsignin: function() {
        this.setState({confirming: true});

    },

    _changeplan: function() {
        this.setState({confirming: false});
    },

    _loginwithfb: function() {
        user.triggerLogin('fb');
    },

    render: function() {
        if (this.state.confirming) {
            return <div className="start-using-btn-container">
                    <h3>Are you sure?</h3>
                    <p>Without signing in, you cannot share your schedule or save your schedules to your account.</p>
                    <p className="linkish" onClick={this._changeplan}>Go Back</p>
                    <p className="linkish" onClick={this.props.onDone}>Use Without Signing In</p>
                </div>
        } else {
            return <div className="start-using-btn-container">
                    <h3>Sign in</h3>
                    <div className="btn loginwithfb" onClick={this._loginwithfb}>Login with Facebook</div>
                    <p className="promise">We never sneak posts on your timeline or spam your friends</p>
                    <p className="linkish" onClick={this._donotsignin}>Do not want to sign in?</p>
            </div>
        }
    }
});

var SplashScreen = React.createClass({
    componentWillMount: function() {
        if (localStore.get('didImport', false)) {
            localStore.del('didImport');
            this.setState({didImport: true});
        } else {
            this.setState({didImport: false});
        }
    },


    componentDidMount: function() {
        user.on('loginstatuschange', this._onUserChange);
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

    render: function() {
        var old = this.state.didImport ? null : <p className="olduser">Old User from Spring 2015? <a href="http://beta.coursepad.me">Click here to import your schedules from old Beta.CoursePad.me.</a></p>;
        return <div className="splash-screen">
            <div className="splash-screen-header"></div>
            <div className="splash-screen-inner">
            <h2>Welcome to a Better CoursePad.me</h2>
            <p className="headline">CoursePad.me is the new way to schedule your courses at Cornell, and it just got even better.</p>
            {old}
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
                    <p><em>Auto-Schedule</em> Miss Schedulizer? Add the courses in your mind, and let CoursePad.me make a schedule, tailored for your taste.</p>
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