var Field = React.createClass({
	getInitialState: function() {
		return {value: ''};
	},

	_onChange: function(e) {
		if (this.props.bind && this.props.bindto) {
			this.props.bind[this.props.bindto] = e.target.value;
			this.setState({value: e.target.value});
		}
	},

	_onBlur: function(e) {
		if (this.props.validator) {
			var validate = this.props.validator(e.target.value);
		}
	},

	render: function() {
		var description = null;
		if (this.state.error) {
			description = <p className="description error">{this.state.error}</p>;
		} else if (this.props.desc) {
			description = <p className="description">{this.props.desc}</p>;
		}

		var props = {
		};

		if (this.props.bind && this.props.bindto) {
			props['value'] = this.state.value;
		}

		return <div>
				<input type={this.props.type} onChange={this._onChange} onBlur={this._onBlur} {...props} />
				{description}
			</div>;
	}
});

var RegisterUser = React.createClass({
	componentDidMount: function() {
		this.bindings = {
			'email': '',
			'password': '',
			'name': ''
		};
	},

	render: function() {
		return <table>
					<tbody>
						<tr><td>Email</td><td><Field type="email" bind={this.bindings} bindto="email" /></td></tr>
						<tr><td>Password</td><td><Field type="password" bind={this.bindings} bindto="password" /></td></tr>
						<tr><td>Re-enter</td><td><Field type="password" /></td></tr>
						<tr><td>Name</td><td><Field type="text" bind={this.bindings} bindto="name" /></td></tr>
					</tbody>
				</table>
	}
});

module.exports = RegisterUser;