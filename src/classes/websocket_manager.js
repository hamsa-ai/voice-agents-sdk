import AudioPlayer from './audio_player'
import AudioRecorder from './audio_recorder'

export default class WebSocketManager {
    constructor(
         url, 
         conversationId,
         onError,
         onStart,
         onTransciprtionRecieved,
         onAnswerRecieved,
         onSpeaking,
         onListening,
         onClosed,
         voiceEnablement,
         apiKey
    ) {
        this.url = `${url}/${conversationId}?api_key=${apiKey}`;
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
        this.voiceEnablement = voiceEnablement;
        this.apiKey = apiKey;
    }

    startCall() {
        try {
            if (!this.ws) {
                this.ws = new WebSocket(this.url);
                this.ws.onopen = this.onOpen.bind(this);
                this.ws.onmessage = this.onMessage.bind(this);
                this.ws.onclose = this.onClose.bind(this);
                this.ws.onerror = this.onError.bind(this);
                this.audioPlayer = new AudioPlayer(this.ws, this.onSpeakingCB, this.onListeningCB)
                this.audioRecorder = new AudioRecorder() 
            }  
        }catch(e) {
            console.log(e)
        }
    }

    onOpen() {
        this.ws.send(JSON.stringify({ event: 'start', streamSid: 'WEBSDK' }));
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
            case 'tools':
                const tools_response = this.run_tools(message.content)
                this.ws.send(JSON.stringify({ event: 'tools_response', tools_response: tools_response,  streamSid: 'WEBSDK' }));
                break;            
            default:
                break;
        }
    }

    onClose(event) {
        this.audioPlayer.stopAndClear();
        this.audioRecorder.stop();
        this.isConnected = false;
        this.ws = null
    }

    onError(error) {
        if (this.onErrorCB) this.onErrorCB(error)
    }

    endCall() {
        if (this.ws) {
            this.audioPlayer.stopAndClear();
            this.ws.send(JSON.stringify({ event: 'stop' }));
            this.audioRecorder.stop();            
            this.#closeWebSocket()
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

    run_tools(tools_array) {
        const results = [];
    
        tools_array.forEach(item => {
            if (item.type === 'function') {
                const functionName = item.function.name;
                const functionArgs = JSON.parse(item.function.arguments);
                if (typeof window[functionName] === 'function') {
                    const response = window[functionName](...Object.values(functionArgs));
                    results.push({
                        id: item.id,
                        function: {
                            name: functionName,
                            response: response
                        }
                    });
                } else {
                    results.push({
                        id: item.id,
                        function: {
                            name: functionName,
                            response: "Error could not find the function"
                        }
                    });                    
                    console.log(`Function ${functionName} is not defined`);
                }
            }
        });
    
        return results;
    }
    #closeWebSocket() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Normal Closure');
        }
    }            
}
