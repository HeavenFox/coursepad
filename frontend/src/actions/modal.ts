import {createAction} from './actions';

export let show = createAction<{priority?: number; content: JSX.Element}>();
export let hide = createAction<{}>();
