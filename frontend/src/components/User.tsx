import React from "react";
import Drop from "tether-drop";
import createReactClass from "create-react-class";

import user from "../store/user";
import schedulestorage from "../store/schedulestorage";
import * as modal from "../utils/modal";

interface UserAvatarProps {
  className?: string;
  pic?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = props => {
  var cls = props.className || "";
  if (props.pic) {
    return (
      <div className={cls} style={{ position: "relative", overflow: "hidden" }}>
        <div
          style={{
            backgroundImage: 'url("' + props.pic.replace('"', '\\"') + '")',
            top: "0",
            right: "0",
            left: "0",
            bottom: "0",
            position: "absolute",
            backgroundSize: "cover"
          }}
        />
      </div>
    );
  }

  return <div className={cls} />;
};

interface UserInfoBoxProps {
  name?: string;
  profilePicture?: string;
}

var UserInfoBox: React.FC<UserInfoBoxProps> = props => {
  var style = props.profilePicture
    ? {
        backgroundImage:
          'url("' + props.profilePicture.replace('"', '\\"') + '")'
      }
    : {};
  return (
    <div className="user-info">
      <UserAvatar className="user-avatar" pic={props.profilePicture} />
      <div className="user-name">{props.name ? props.name : "Guest"}</div>
    </div>
  );
};

interface UserMenuProps {
  clickHandler: Function;
}

var UserMenu = createReactClass<UserMenuProps, any>({
  _fbLogin: function() {
    user.triggerLogin("fb");
  },

  _googLogin: function() {
    // user.triggerLogin('goog');
  },

  getInitialState: function() {
    return { user: user.getCurrentUser() };
  },

  _toggleEmail: function() {
    this.setState({ pane: "two" });
  },

  _emailLogin: function(e) {
    e.preventDefault();
    var elements = e.target.elements;
    user.emailLogin(elements["email"].value, elements["password"].value);
  },

  _logout: async function() {
    var result = await modal.alert(
      "Delete Local Schedule",
      "Do you want to remove your schedules from local computer as well?",
      {
        y: "Yes",
        n: "No"
      },
      {},
      true
    );
    if (result !== null) {
      user.logout();
      if (result === "y") {
        schedulestorage.deleteLocal();
      }
    }
  },

  _onUserChange: function() {
    this.setState({ user: user.getCurrentUser() });
  },

  componentDidMount: function() {
    user.on("loginstatuschange", this._onUserChange);
  },

  componentWillUnmount: function() {
    user.off("loginstatuschange", this._onUserChange);
  },

  render: function() {
    if (this.state.user) {
      return (
        <div className="user-menu">
          <div className="user-options">
            <UserInfoBox
              profilePicture={this.state.user.profilePicture}
              name={this.state.user.name}
            />
            <hr />

            <p className="linkish" onClick={this._logout}>
              Logout
            </p>
          </div>
        </div>
      );
    } else {
      var className = "user-menu guest";
      if (this.state.pane) {
        className += " " + this.state.pane;
      }
      return (
        <div className={className}>
          <div className="user-options">
            <UserInfoBox />
            <hr />

            <p className="linkish" onClick={this._fbLogin}>
              Login with Facebook
            </p>
            {/*
                    <p className="linkish" onClick={this._googLogin}>Login with Google</p>
                    <p className="linkish" onClick={this._toggleEmail}>Login with Email</p>
                    <hr />
                    <p className="linkish">Register with Email</p>*/}
          </div>
          <div className="user-loginform">
            {/*
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
                */}
          </div>
        </div>
      );
    }
  }
});

var User = createReactClass({
  getInitialState: function() {
    return { user: user.getCurrentUser() };
  },

  _onUserChange: function() {
    this.setState({ user: user.getCurrentUser() });
  },

  _click: function() {
    this.menu.close();
  },

  componentDidMount: function() {
    user.on("loginstatuschange", this._onUserChange);
    var contentDescriptor = (
      <div>
        <UserMenu clickHandler={this._click} />
      </div>
    );
    this.menu = new Drop({
      target: this.refs["trigger"],
      content: contentDescriptor,
      position: "bottom center",
      openOn: "click",
      constrainToWindow: true,
      tetherOptions: {
        constraints: [
          {
            to: "scrollParent",
            pin: true
          }
        ]
      }
    });
  },

  componentWillUnmount: function() {
    user.off("loginstatuschange", this._onUserChange);
  },

  render: function() {
    var userName = "Guest";
    if (this.state.user) {
      userName = this.state.user.name;
    }
    return (
      <div id="current-user">
        <div className="current-user-inner">
          <span ref="trigger" className="btnish">
            <UserAvatar
              className="topbar-user-icon"
              pic={this.state.user && this.state.user.profilePicture}
            />
            <span className="current-user-name">{userName + " \u25BE"}</span>
          </span>
        </div>
      </div>
    );
  }
});

export default User;
