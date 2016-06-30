import {route} from './routes/router';
import * as meta from './store/meta';
import App from './components/App';

// Import routes
import './routes/root';
import './routes/shared';

meta.upgradeSchema();

ReactDOM.render(<App />, document.getElementById('app'));

route();
