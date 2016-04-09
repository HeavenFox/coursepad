import modal from '../../store/modal';

export default class Modal extends React.Component<{}, {modal: JSX.Element}> {
    constructor(props) {
        super(props);
        this.state = {modal: null};
    }

    componentDidMount() {
        modal.on('change', this._onModalChange);
    }

    componentWillUnmount() {
        modal.off('change', this._onModalChange);
    }

    _onModalChange = () => {
        this.setState({modal: modal.element});
    }

    render() {
        if (this.state.modal) {
            return <div className="modal-container">
                <div className="modal-backdrop"></div>
                <div className="modal-window">
                    {this.state.modal}
                </div>
            </div>;
        } else {
            return null;
        }
    }
}
