let ws;
const requiredSamples = 1 * 16000;
let audioBuffer = []; 
let isConnected = false
let last_transcription_date = new Date();
let last_voice_byte_date = new Date();
let is_media = false;
function startCall(prompt_id) {
    ws = new WebSocket(`wss://bots-dev.tryhamsa.com/stream/prompt_${prompt_id}`); // Ensure the WebSocket URL matches your Flask socket route
    const audioPlayer = new AudioPlayer(ws);
    ws.onopen = function() {
        var callButton = document.getElementById('bot-call-button');
        ws.send(JSON.stringify({ event: 'start', streamSid: 'stream1' })); // Example of sending a start event
        isConnected = true
        callButton.textContent = "End Call"
        last_transcription_date = new Date();
        callButton.classList.add("btn-danger")
        document.getElementById('callStatus').textContent = 'Call In Progress';
        document.getElementById('prompt_form').classList.add('hidden')
        document.getElementById('avatar-container').classList.remove('hidden')

        startStreaming()
    };

    ws.onmessage = function(event) {
        const message = JSON.parse(event.data)
        if (message.event === 'media' && message.media) {
            if (!is_media) {
                last_voice_byte_date = new Date()
                const time1 = last_transcription_date.getTime();
                const time2 = last_voice_byte_date.getTime();                
                const differenceInMs = time2 - time1;
                document.getElementById('callStatus').textContent = `Response: ${differenceInMs}ms`;
                startSpeaking()
                is_media = true
            }
            audioPlayer.enqueueAudio(message.media.payload);
        }
        if (message.event === 'clear') {
            audioPlayer.stopAndClear()
        }

        if (message.event === 'mark') {
            audioPlayer.addMark(message.mark.name)
        }

        if (message.event === 'transcription') {
            last_transcription_date = new Date();
            is_media = false;
            addMessage(message.content, "yours")
        }
        if (message.event === 'answer') {
            addMessage(message.content, "mine")
        }  
        if (message.event === 'update_last_answer') {
            updateLastAnswer(message.content)
        }   
        if (message.event === 'remove_last_answer') {
            removeLastAnswer()
        }  
        if (message.event === 'update_last_transcription') {
            updateLastTranscription(message.content)
        }         
        
        if (message.event === 'outcome') {
            //outcomebox = document.getElementById("outcome_results")
            rendered = renderJsonToTable(JSON.parse(message.content),"outcome_results")
            if (!rendered) {
                outcomebox = document.getElementById("outcome_results")
                outcomebox.innerHTML = message.content
            }
        }
    };

    ws.onclose = function(event) {
        document.getElementById('callStatus').textContent = 'Call Ended';
        console.log('Connection closed', event);
        audioPlayer.stopAndClear()
        isConnected = false
    };

    ws.onerror = function(error) {
        console.log('WebSocket Error: ', error);
    };
}

function endCall() {
    if (ws) {
        var callButton = document.getElementById('bot-call-button');
        ws.send(JSON.stringify({ event: 'stop' }));
        //ws.close();
        callButton.textContent = "Test Now!"
        callButton.classList.remove("btn-danger") 
        document.getElementById('prompt_form').classList.remove('hidden')
        document.getElementById('avatar-container').classList.add('hidden')               
    }
}

async function startStreaming() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }, video: false });
    audioContext = new AudioContext({ sampleRate: 16000 });

    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    processor = audioContext.createScriptProcessor(4096, 1, 1);
    mediaStreamSource.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        data_to_send = new Float32Array(inputData).buffer
        processAudioData(data_to_send)

        // audioBuffer = audioBuffer.concat(Array.from(inputData)); // Accumulate audio data
        
        // // Check if we have enough data for 0.5 seconds
        // if (audioBuffer.length >= requiredSamples) {
        //     // Send the buffered data
        //     data_to_send = new Float32Array(audioBuffer.slice(0, requiredSamples)).buffer
        //     processAudioData(data_to_send)
        //     // Remove the sent samples from the buffer
        //     audioBuffer = audioBuffer.slice(requiredSamples);
        // }                        
    };
}

function processAudioData(rawAudioData) {
    if (ws && isConnected) {
        const base64String = btoa(String.fromCharCode(...new Uint8Array(rawAudioData)));
        ws.send(JSON.stringify({ event: 'media', streamSid: 'stream1', media: { payload: base64String } }))                     
    }
}

function toBinary(string) {
    const codeUnits = new Uint16Array(string.length);
    for (let i = 0; i < codeUnits.length; i++) {
      codeUnits[i] = string.charCodeAt(i);
    }
    return btoa(String.fromCharCode(...new Uint8Array(codeUnits.buffer)));
  }

  function encodeUnicode(str) {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
        return String.fromCharCode('0x' + p1)
      })
    )
  }

  function toggleChatBox() {
    const selectBox = document.getElementById('previousPrompts');
    if (selectBox.value == "new") { 
        showToast('Please select a prompt from the list');

        return
    }
    const promptId = selectBox.value
    var chatBox = document.getElementById('chat-box');
    var callButton = document.getElementById('bot-call-button');
    if (chatBox.classList.contains('hidden')) {
        chatBox.classList.remove('hidden');
        setTimeout(() => {
            chatBox.style.opacity = 1;
        }, 100);
        startCall(promptId)
    } else {
        chatBox.style.opacity = 0;
        setTimeout(() => {
            chatBox.classList.add('hidden');
        }, 500);
        callButton.style.display = 'flex';
        endCall()
    }
}

function addMessage(text, owner) {
    var chatBox = document.getElementById('chat-box');
    var newMessage = document.createElement('div');
    newMessage.classList.add('message', owner);

    // Replace newline characters \n with HTML line breaks <br>
    var formattedText = text.replace(/\n/g, '<br>');

    newMessage.innerHTML = `<p>${formattedText}</p>`;
    chatBox.appendChild(newMessage);
}

function updateLastAnswer(text) {
    var chatBox = document.getElementById('chat-box');
    var allMineDivs = chatBox.querySelectorAll('div.mine');
    
    if (allMineDivs.length > 0) {
        // Get the last div with the class 'mine'
        var lastMineDiv = allMineDivs[allMineDivs.length - 1];
        var formattedText = text.replace(/\n/g, '<br>');
        lastMineDiv.innerHTML = `<p>${formattedText}</p>`;
    } else {
        console.log('No divs with the class "mine" found.');
    }
}

function updateLastTranscription(text) {
    var chatBox = document.getElementById('chat-box');
    var allMineDivs = chatBox.querySelectorAll('div.yours');
    console.log("Shoud update last transcription")
    if (allMineDivs.length > 1) {
        // Get the last div with the class 'mine'
        var lastMineDiv = allMineDivs[allMineDivs.length - 2];
        var formattedText = text.replace(/\n/g, '<br>');
        lastMineDiv.innerHTML = `<p>${formattedText}</p>`;
        var lastMineDiv = allMineDivs[allMineDivs.length - 1];
        lastMineDiv.remove();        
    } else {
        console.log('No divs with the class "mine" found.');
    }
}
function removeLastAnswer() {
    var chatBox = document.getElementById('chat-box');
    var allMineDivs = chatBox.querySelectorAll('div.mine');
    
    if (allMineDivs.length > 0) {
        // Get the last div with the class 'mine'
        var lastMineDiv = allMineDivs[allMineDivs.length - 1];
        lastMineDiv.remove();
    } else {
        console.log('No divs with the class "mine" found.');
    }
}

function toBinary(string) {
    const codeUnits = new Uint16Array(string.length);
    for (let i = 0; i < codeUnits.length; i++) {
      codeUnits[i] = string.charCodeAt(i);
    }
    return btoa(String.fromCharCode(...new Uint8Array(codeUnits.buffer)));
  }

  function fromBinary(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return String.fromCharCode(...new Uint16Array(bytes.buffer));
  }
