class AudioProcessor extends AudioWorkletProcessor {
  encodeBase64(bytes) {
    const base64abc = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'];
    let result = '';
    let i;
    const l = bytes.length;
    for (i = 2; i < l; i += 3) {
      result += base64abc[bytes[i - 2] >> 2];
      result += base64abc[(bytes[i - 2] & 0x03) << 4 | bytes[i - 1] >> 4];
      result += base64abc[(bytes[i - 1] & 0x0f) << 2 | bytes[i] >> 6];
      result += base64abc[bytes[i] & 0x3f];
    }
    if (i === l + 1) {
      // 1 octet yet to write
      result += base64abc[bytes[i - 2] >> 2];
      result += base64abc[(bytes[i - 2] & 0x03) << 4];
      result += '==';
    }
    if (i === l) {
      // 2 octets yet to write
      result += base64abc[bytes[i - 2] >> 2];
      result += base64abc[(bytes[i - 2] & 0x03) << 4 | bytes[i - 1] >> 4];
      result += base64abc[(bytes[i - 1] & 0x0f) << 2];
      result += '=';
    }
    return result;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0];
      const rawAudioData = new Float32Array(inputData.length);
      rawAudioData.set(inputData);

      // Convert the audio data to a Uint8Array for base64 encoding
      const uint8Array = new Uint8Array(rawAudioData.buffer);

      // Use the custom base64 encoding function
      const base64String = this.encodeBase64(uint8Array);

      // Send the base64 string to the main thread via the port
      this.port.postMessage({
        event: 'media',
        streamSid: 'WEBSDK',
        media: {
          payload: base64String
        }
      });
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);