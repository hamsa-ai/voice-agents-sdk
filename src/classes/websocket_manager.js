import AudioPlayer from './audio_player'
import AudioRecorder from './audio_recorder'

export default class WebSocketManager {
    constructor(url, prompt_id) {
        this.url = `${url}/prompt_${prompt_id}`;
        this.ws = null;
        this.isConnected = false;
        this.audioPlayer = null;
        this.audioRecorder = null;
        this.last_transcription_date = new Date();
        this.last_voice_byte_date = new Date();
        this.is_media = false;
    }

    startCall() {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.audioPlayer = new AudioPlayer(this.ws)
        this.audioRecorder = new AudioRecorder()   
    }

    onOpen() {
        this.ws.send(JSON.stringify({ event: 'start', streamSid: 'stream1' }));
        this.isConnected = true;

        // var callButton = document.getElementById('bot-call-button');
        // callButton.textContent = "End Call";
        // callButton.classList.add("btn-danger");
        // document.getElementById('callStatus').textContent = 'Call In Progress';
        // document.getElementById('prompt_form').classList.add('hidden');
        // document.getElementById('avatar-container').classList.remove('hidden');

        this.audioRecorder.startStreaming(this.ws);
    }

    onMessage(event) {
        const message = JSON.parse(event.data);
        switch (message.event) {
            case 'media':
                if (message.media) {
                    if (!this.is_media) {
                        this.last_voice_byte_date = new Date();
                        const differenceInMs = this.last_voice_byte_date - this.last_transcription_date;
                        //document.getElementById('callStatus').textContent = `Response: ${differenceInMs}ms`;
                        this.is_media = true;
                    }
                    this.audioPlayer.enqueueAudio(message.media.payload);
                }
                break;
            case 'clear':
                this.audioPlayer.stopAndClear();
                break;
            case 'mark':
                this.audioPlayer.addMark(message.mark.name);
                break;
            // case 'transcription':
            //     this.last_transcription_date = new Date();
            //     this.is_media = false;
            //     addMessage(message.content, "yours");
            //     break;
            // case 'answer':
            //     addMessage(message.content, "mine");
            //     break;
            // case 'update_last_answer':
            //     updateLastAnswer(message.content);
            //     break;
            // case 'remove_last_answer':
            //     removeLastAnswer();
            //     break;
            // case 'update_last_transcription':
            //     updateLastTranscription(message.content);
            //     break;
            // case 'outcome':
            //     renderJsonToTable(JSON.parse(message.content), "outcome_results");
            //     break;
            default:
                break;
        }
    }

    onClose(event) {
        //document.getElementById('callStatus').textContent = 'Call Ended';
        console.log('Connection closed', event);
        this.audioPlayer.stopAndClear();
        this.isConnected = false;
    }

    onError(error) {
        console.log('WebSocket Error: ', error);
    }

    endCall() {
        if (this.ws) {
            //var callButton = document.getElementById('bot-call-button');
            this.ws.send(JSON.stringify({ event: 'stop' }));
            // callButton.textContent = "Test Now!";
            // callButton.classList.remove("btn-danger");
            // document.getElementById('prompt_form').classList.remove('hidden');
            // document.getElementById('avatar-container').classList.add('hidden');
        }
    }
}
