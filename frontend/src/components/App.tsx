import React from 'react';
import Calendar from './Calendar';
import SearchBar from './SearchBar';
import Sidebar from './Sidebar';
import TermSelector from './TermSelector';
import User from './User';
import LeftBar from './LeftBar';

import Modal from './app/Modal';


export default class App extends React.Component<{}, {}> {
    render() {
        return <div>
        <header>
            <div id="logo"></div>
            <div id="topnav">
                <TermSelector />
                <User />
            </div>
            <div id="topsearch">
                <SearchBar />
            </div>
        </header>
        <div id="main-container">
            <div id="sidebar">
                <LeftBar />
            </div>
            <div id="main">
                <div id="calendar">
                    <Calendar />
                </div>
                <div id="utilities">
                    <Sidebar />
                </div>
                <div className="clearboth" />
                <footer>
                    CoursePad.me is <a href="https://open.coursepad.me">Open Source Software</a>. Data Courtesy of Cornell University Registrar. <a href="/static/tos.html">Term of Service</a> - <a href="/static/privacy.html">Privacy Policy</a> - <a href="/static/ack.html">Acknowledgement</a>
                </footer>
            </div>
            <div className="clearboth" />
        </div>
        <Modal />
        </div>;



    }
}
