import './design/styles.css';
import WebSocketManager from './classes/websocket_manager'
import FancyButton from './classes/facny_button';
let webSocketManager;
let iframe;

export function init({agentId, renderButton = false, voiceEnablement = false, onError = null, onStart = null, onTransciprtionRecieved = null, onAnswerRecieved = null, onSpeaking = null, onListening = null, onClosed = null}) {
    const fancyButton = new FancyButton(voiceEnablement)
    let _onSpeaking = onSpeaking, _onListening = onListening
    if (renderButton || voiceEnablement) {
        _onSpeaking = () => {
            fancyButton.startWaveAnimation()
            if (onSpeaking) onSpeaking()
        }
        _onListening = () => {
            fancyButton.stopWaveAnimation()
            if (onListening) onListening()
        }        
    }

    webSocketManager = new WebSocketManager(
        'wss://bots-dev.tryhamsa.com/stream',
         agentId,
         onError,
         onStart,
         onTransciprtionRecieved,
         onAnswerRecieved,
         _onSpeaking,
         _onListening,
         onClosed,
         voiceEnablement
    );

    if (renderButton || voiceEnablement) {
        fancyButton.createFloatingButton(webSocketManager)
    }

}

export function start() {
    try {
        webSocketManager.startCall()
        }catch(e) {
            throw("Error in starting the call! Make sure you initialized the client .init()")
        }
}

export function end() {
    try {
        webSocketManager.endCall()
        }catch(e) {
            throw("Error in ending the call! Make sure you initialized the client .init()")
        }
}

export function pause() {
    webSocketManager.pauseCall()
}

export function resume() {
    webSocketManager.resumeCall()
}
