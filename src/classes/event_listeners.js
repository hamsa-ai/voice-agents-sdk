export class EvenetsListener {

    initListeners() {
        window.addEventListener('audioplaystatechange', (event) => {
            console.log(event.detail)
            if (event.detail) {
                startWaveAnimation();
            } else {
                stopWaveAnimation();
            }
        });
    }
}