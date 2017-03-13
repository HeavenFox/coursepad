import React from 'react';
import ReactDOM from 'react-dom';
import * as sharing from '../../controllers/sharing.js';
import * as fb from '../../thirdparty/fb';
import * as twitter from '../../thirdparty/twitter';

interface SocialNetworksProps {
    url: string;
}

var SocialNetworks = React.createClass<SocialNetworksProps, any>({
    componentDidMount: function() {
        var root = ReactDOM.findDOMNode(this);
        (async function() {
            await twitter.init();

            window.twttr.widgets.load(root);
        })();

        (async function() {
            await fb.init();

            window.FB.XFBML.parse(root);
        })();
    },

    render: function() {
        if (!this.props.url) {
            return null;
        }

        return <div className="sharing-social-networks">
            <div className="fb-share-button" data-href={this.props.url} data-layout="button"></div>
            <div className="twitter-share-button">
                <a href="https://twitter.com/share" className="twitter-share-button" data-url={this.props.url} data-text="Check out my schedule on @CoursePadme!" data-count="none"></a>
            </div>
        </div>;
    }
})

var Sharing = React.createClass({
    getInitialState: function() {
        return {status: 'idle'};
    },

    _share: async function() {
        // Initialize FB and Twitter
        fb.init();
        twitter.init();

        this.setState({status: 'sending', url: null});
        try {
            var result = await sharing.shareSchedule();
            this.setState({status: 'shared', url: result['url']});
        } catch (e) {
            this.setState({status: 'failed', url: null});
        }

    },

    _back: function() {
        this.setState({status: 'idle', url: null});
    },

    render: function() {
        var shareButton;
        var failureMessage = null;
        switch (this.state.status) {
        case 'failed':
            failureMessage = <p>Failed to Share. Please try again.</p>;
            // fall through
        case 'idle':
            shareButton = <p className="btnish" onClick={this._share}>Share this Schedule</p>;
            break;
        case 'sending':
            shareButton = <p>Sharing...</p>;
            break;
        case 'shared':
            shareButton = <p>Shared. <span className="btnish" onClick={this._back}>(Back)</span></p>;
            break;
        }
        var url = null, social = null;

        if (this.state.url) {
            url = <div>
                <input defaultValue={this.state.url} readOnly={true} />
            </div>;
            social = <SocialNetworks url={this.state.url} />;
        }

        return <div className="sharing utilities-item">
        <h2>Sharing</h2>
        <div className="sharing-inner">
            {shareButton}
            {failureMessage}
            {url}
            {social}
        </div>
        </div>;
    }
});

export default Sharing;
