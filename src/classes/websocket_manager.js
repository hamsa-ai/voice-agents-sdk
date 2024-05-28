import AudioPlayer from './audio_player'
import AudioRecorder from './audio_recorder'

export default class WebSocketManager {
    constructor(
         url, 
         prompt_id,
         onError,
         onStart,
         onTransciprtionRecieved,
         onAnswerRecieved,
         onSpeaking,
         onListening,
         onClosed
    ) {
        this.url = `${url}/prompt_${prompt_id}`;
        this.ws = null;
        this.isConnected = false;
        this.audioPlayer = null;
        this.audioRecorder = null;
        this.last_transcription_date = new Date();
        this.last_voice_byte_date = new Date();
        this.is_media = false;
        this.onErrorCB = onError;
        this.onStartCB = onStart;
        this.onTransciprtionRecievedCB = onTransciprtionRecieved;
        this.onAnswerRecievedCB = onAnswerRecieved;
        this.onSpeakingCB = onSpeaking;
        this.onListeningCB = onListening;
        this.onClosedCB = onClosed;
    }

    startCall() {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.audioPlayer = new AudioPlayer(this.ws, this.onSpeakingCB, this.onListeningCB)
        this.audioRecorder = new AudioRecorder()   
    }

    onOpen() {
        this.ws.send(JSON.stringify({ event: 'start', streamSid: 'stream1' }));
        this.isConnected = true;
        this.audioRecorder.startStreaming(this.ws);
        if (this.onStartCB) this.onStartCB()
    }

    onMessage(event) {
        const message = JSON.parse(event.data);
        switch (message.event) {
            case 'media':
                if (message.media) {
                    this.audioPlayer.enqueueAudio(message.media.payload);
                }
                break;
            case 'clear':
                this.audioPlayer.stopAndClear();
                break;
            case 'mark':
                this.audioPlayer.addMark(message.mark.name);
                break;
            case 'transcription':
                if (this.onTransciprtionRecievedCB) this.onTransciprtionRecievedCB(message.content)
                break;
            case 'answer':
                if (this.onAnswerRecievedCB) this.onAnswerRecievedCB(message.content)
                break;
            default:
                break;
        }
    }

    onClose(event) {
        //document.getElementById('callStatus').textContent = 'Call Ended';
        this.audioPlayer.stopAndClear();
        this.isConnected = false;
    }

    onError(error) {
        if (this.onErrorCB) this.onErrorCB(error)
    }

    endCall() {
        if (this.ws) {
            this.ws.send(JSON.stringify({ event: 'stop' }));
            if (this.onClosedCB) this.onClosedCB()
        }
    }

    pauseCall() {
       this.audioPlayer.pause()
       this.audioRecorder.pause() 
    }
    
    resumeCall() {
        this.audioPlayer.resume()
        this.audioRecorder.resume() 
     }    
}
