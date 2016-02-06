var Drop : any = require('tether-drop');

import * as meta from '../store/meta.ts';
import termdb from '../store/termdb.ts';
import schedules from '../store/schedules.ts';
import * as humanize from '../consts/humanize.ts';

interface TermListProps {
    clickHandler: Function;
}

var TermList = React.createClass<TermListProps, any>({
    getInitialState: function() {
        return {
            remoteTerms: null,
            localTerms: []
        };
    },

    componentWillMount: function() {
        var self = this;

        meta.getRemoteTerms().then(function(terms) {
            self.setState({remoteTerms: Object.keys(terms), localTerms: Object.keys(meta.getLocalTerms())});
        });
    },

    render: function() {
        var local = this.state.localTerms || [];
        var terms = humanize.sortTerms(this.state.remoteTerms || this.state.localTerms || [], true);
        var lis;
        if (terms.length === 0) {
            lis = <li className="loading">Loading Terms...</li>;
        } else {
            lis = terms.map(function(term) {
                var isLocal = local.indexOf(term) > -1;
                return <li className="clickable menuitem" onClick={this.props.clickHandler.bind(null, term)} key={term}>{humanize.getTermName(term)}</li>
            }, this);
        }
        return <div className="menu" ref="menu"><ul>
            {lis}
        </ul></div>
    }
});

var TermSelector = React.createClass({
    getInitialState: function() {
        return {
            currentTerm: null,
            ready: false
        };
    },

    componentWillMount: function() {
        termdb.on('readystatechange', this.termDBReadyStateChange);
    },

    componentWillUnmount: function() {
        termdb.off('readystatechange', this.termDBReadyStateChange);
    },

    termDBReadyStateChange: function() {
        this.setState({
            currentTerm: termdb.getCurrentTerm(),
            ready: termdb.ready
        });
    },

    componentDidMount: function() {
        var contentDescriptor = <TermList clickHandler={this._click} />;
        this.menu = new Drop({
            target: this.refs['selector'],
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
        schedules.setCurrentSchedule(term);

        this.menu.close();

    },

    render: function() {
        var currentTermName = 'Semester';
        if (this.state.currentTerm) {
            currentTermName = humanize.getTermName(this.state.currentTerm.term);

            if (!this.state.ready) {
                currentTermName += '...';
            }
        }
        return <div id="term-selector"><span ref="selector" className="btnish">{currentTermName} &#9662;</span></div>
    }
});

export default TermSelector;