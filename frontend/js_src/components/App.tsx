import Calendar from './Calendar.tsx';
import SearchBar from './SearchBar.tsx';
import Sidebar from './Sidebar.tsx';
import TermSelector from './TermSelector.tsx';
import User from './User.tsx';
import LeftBar from './LeftBar.tsx';

export default class App extends React.Component<{}, {}> {
    render() {
        return <div>
        <div id="banner-container"></div>
        <header>
            <div id="logo"></div>
            <div id="topnav">
                <div id="term-selector">
                    <TermSelector />
                </div>
                <div id="current-user">
                    <User />
                </div>
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
                <div className="clearboth"></div>
                <footer>&copy; CoursePad.me. Data Courtesy of Cornell University Registrar. <a href="/static/tos.html">Term of Service</a> - <a href="/static/privacy.html">Privacy Policy</a> - <a href="/static/ack.html">Acknowledgement</a></footer>
            </div>
            <div className="clearboth"></div>
            </div>;
        <div className="loading hidden">Loading...</div>
        <div className="modal-container hidden">
            <div className="modal-backdrop"></div>
            <div className="modal-window">
                <div id="class-number-list"></div>
            </div>
        </div>
        </div>;
        
        

    }   
}