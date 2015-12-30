import BasicInfo from './sidebar/BasicInfo.tsx';
import Basket from './sidebar/Basket.tsx';
import Tools from './sidebar/Tools.tsx';
import Magic from './sidebar/Magic.tsx';
import Sharing from './sidebar/Sharing.tsx';
import IfLoginStatus from './meta/IfLoginStatus.tsx';
import Sync from './sidebar/Sync.tsx';

var Sidebar = React.createClass({
    render: function() {
        return <div>
            <BasicInfo />
            <Basket />
            <IfLoginStatus>
                <Sharing />
            </IfLoginStatus>
            <Magic />
            <Sync />
            <Tools />
        </div>
    }
});

export default Sidebar;