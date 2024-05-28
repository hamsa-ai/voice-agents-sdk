import './design/styles.css';
import WebSocketManager from './classes/websocket_manager'
import { FancyButton } from './classes/facny_button';

window.addEventListener('audioplaystatechange', (event) => {
    console.log(event.detail)
    if (event.detail) {
        startWaveAnimation();
    } else {
        stopWaveAnimation();
    }
});

export function init({agentId, renderButton = false, onStart = null, onTransciprtionRecieved = null, onAnswerRecieved = null, onClosed = null}) {
    const webSocketManager = new WebSocketManager('wss://bots-dev.tryhamsa.com/stream', agentId);
    if (renderButton) {
        new FancyButton(webSocketManager).createFloatingButton()
    }
}