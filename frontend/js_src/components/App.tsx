import Calendar from './Calendar.tsx';
import SearchBar from './SearchBar.tsx';
import Sidebar from './Sidebar.tsx';
import TermSelector from './TermSelector.tsx';
import User from './User.tsx';
import LeftBar from './LeftBar.tsx';

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
                <footer>&copy; CoursePad.me. Data Courtesy of Cornell University Registrar. <a href="/static/tos.html">Term of Service</a> - <a href="/static/privacy.html">Privacy Policy</a> - <a href="/static/ack.html">Acknowledgement</a></footer>
            </div>
            <div className="clearboth" />
        </div>
        <Modal />
        </div>;



    }
}
