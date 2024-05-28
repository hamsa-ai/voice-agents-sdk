export default class FancyButton {
    constructor() {
        this.isCallStarted = false
    }

    createFloatingButton(WSManager) {
        this.WSManager = WSManager
        const button = document.createElement('div');
        button.id = 'fancy-floating-button';
        button.innerHTML = '<span class="icon">📞</span>'; // Use an appropriate icon
        button.addEventListener('click', () => { this.toggleCall() } );
        document.body.appendChild(button);
    }

    toggleCall() {
        if (!this.isCallStarted) {
            this.startCall();
        } else {
            this.endCall();
        }
        this.isCallStarted = !this.isCallStarted;
        this.updateButtonAppearance();
    }

    startCall() {
        this.WSManager.startCall()
    }

    endCall() {
        if (this.WSManager) {
            this.WSManager.endCall();
        }
    }

    updateButtonAppearance() {
        const button = document.getElementById('fancy-floating-button');
        if (this.isCallStarted) {
            button.style.backgroundColor = '#f44336'; // Change to a different color when the call is in progress
            button.innerHTML = '<span class="icon">✖️</span>'; // Change icon to indicate end call
        } else {
            button.style.backgroundColor = '#ff4081'; // Original color
            button.innerHTML = '<span class="icon">📞</span>'; // Original icon
        }
    }

    startWaveAnimation() {
        const button = document.getElementById('fancy-floating-button');
        const wave = document.createElement('div');
        wave.className = 'wave';
        wave.id = 'wave-animation';
        button.appendChild(wave);
    }

    stopWaveAnimation() {
        const wave = document.getElementById('wave-animation');
        if (wave) {
            wave.remove();
        }
    }
}