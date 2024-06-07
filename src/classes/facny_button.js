export default class FancyButton {
    constructor(voiceEnablement) {
        this.isCallStarted = false;
        this.iframe = null;
        this.isIframeLoaded = false;
        this.voiceEnablement = voiceEnablement
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
            if (this.voiceEnablement) {
                this.createIframe(()=>{
                    this.startCall();
                })
            }else{
                this.startCall();
            }
        } else {
            this.removeIframe();
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

    createIframe(callback) {
        document.body.innerHTML = '';
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'persistent-iframe';
        this.iframe.src = window.location.href; // Load the current page URL in the iframe
        this.iframe.style.position = 'fixed';
        this.iframe.style.top = '0';
        this.iframe.style.left = '0';
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        this.iframe.style.border = 'none';
        this.iframe.style.zIndex = '1'; // Ensure iframe is interactive and behind the button
        this.iframe.style.overflow = 'auto'; // Ensure iframe content is scrollable
        this.iframe.addEventListener('load', () => {
            if (!this.isIframeLoaded) {
                console.log("Iframe Loaded First time")
                callback();
                this.isIframeLoaded = true
            }
        });
        document.body.appendChild(this.iframe);
    }
    
    removeIframe() {
        if (this.iframe) {
            window.location.href = this.iframe.location.href
            this.iframe.remove();
            this.isIframeLoaded = false; // Reset the flag if the iframe is removed
        }
    }    
}