/**
 * @jsx React.DOM
 */
var Drop = require('drop');

var meta = require('../store/meta.js');
var humanize = require('../consts/humanize.js');

var TermList = React.createClass({
    getInitialState: function() {
        return {
            remoteTerms: null,
            localTerms: []
        };
    },

    componentWillMount: function() {
        var self = this;

        meta.getRemoteTerms().then(function(terms) {
            self.setState({remoteTerms: terms, localTerms: meta.getLocalTerms()});
        });
    },

    render: function() {
        var local = this.state.localTerms || [];
        var terms = humanize.sortTerms(this.state.remoteTerms || this.state.localTerms || []);
        var lis;
        if (terms.length == 0) {
            lis = <li className="loading">Loading Terms...</li>;
        } else {
            lis = terms.map(function(term) {
                var isLocal = local.indexOf(term) > -1;
                return <li className="clickable menuitem" onClick={this.props['clickHandler'].bind(null, term)} key={term}>{humanize.getTermName(term)}</li>
            }, this);
        }
        console.log(lis);
        return <div className="menu" ref="menu"><ul>
            {lis}
        </ul></div>
    }
});

var TermSelector = React.createClass({
    componentDidMount: function() {
        var contentDescriptor = <TermList clickHandler={this._click} />;
        this.menu = new Drop({
            target: this.refs['selector'].getDOMNode(),
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

    _click: function(term) {
        console.log(term);

        this.menu.close();

    },

    render: function() {
        return <div><span ref="selector" className="clickable">Fall 2014 &#9662;</span></div>
    }
});

module.exports = TermSelector;