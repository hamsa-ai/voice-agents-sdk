import './design/styles.css';
import WebSocketManager from './classes/websocket_manager'

let isCallStarted = false;
let webSocketManager;

function createFloatingButton(_promptId) {
    const button = document.createElement('div');
    button.id = 'fancy-floating-button';
    button.innerHTML = '<span class="icon">📞</span>'; // Use an appropriate icon
    button.addEventListener('click', () => { toggleCall(_promptId) } );
    document.body.appendChild(button);
}

function toggleCall(_promptId) {
    if (!isCallStarted) {
        startCall(_promptId);
    } else {
        endCall();
    }
    isCallStarted = !isCallStarted;
    updateButtonAppearance();
}

function startCall(_promptId) {
    webSocketManager = new WebSocketManager('wss://bots-dev.tryhamsa.com/stream', _promptId);
    webSocketManager.startCall()
}

function endCall() {
    if (webSocketManager) {
        webSocketManager.endCall();
    }
}

function updateButtonAppearance() {
    const button = document.getElementById('fancy-floating-button');
    if (isCallStarted) {
        button.style.backgroundColor = '#f44336'; // Change to a different color when the call is in progress
        button.innerHTML = '<span class="icon">✖️</span>'; // Change icon to indicate end call
    } else {
        button.style.backgroundColor = '#ff4081'; // Original color
        button.innerHTML = '<span class="icon">📞</span>'; // Original icon
    }
}

function startWaveAnimation() {
    const button = document.getElementById('fancy-floating-button');
    const wave = document.createElement('div');
    wave.className = 'wave';
    wave.id = 'wave-animation';
    button.appendChild(wave);
}

function stopWaveAnimation() {
    const wave = document.getElementById('wave-animation');
    if (wave) {
        wave.remove();
    }
}

window.addEventListener('audioplaystatechange', (event) => {
    console.log(event.detail)
    if (event.detail) {
        startWaveAnimation();
    } else {
        stopWaveAnimation();
    }
});


export function init(_promptId) {
    createFloatingButton(_promptId);
}