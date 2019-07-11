import { route } from "./routes/router";
import * as meta from "./store/meta";
import App from "./components/App";
import React from "react";
import ReactDOM from "react-dom";

import "./sass/main.scss";

import * as serviceWorker from "./serviceWorker";

// Import routes
import "./routes/root";
import "./routes/shared";

window.React = React;
window.ReactDOM = ReactDOM;

meta.upgradeSchema();

ReactDOM.render(<App />, document.getElementById("app"));

route();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
