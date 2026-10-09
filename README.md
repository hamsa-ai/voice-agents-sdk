# Hamsa Voice Agents Web SDK

Hamsa Voice Agents Web SDK is a JavaScript library for integrating voice agents from <https://dashboard.tryhamsa.com>. This SDK provides a seamless way to incorporate voice interactions into your web applications with high-quality real-time audio communication.

## Installation

Install the SDK via npm:

```bash
npm i @hamsa-ai/voice-agents-sdk
```

## Usage

### Using via npm

First, import the package in your code:

```javascript
import { HamsaVoiceAgent } from "@hamsa-ai/voice-agents-sdk";
```

Initialize the SDK with a public key (`pk_…`) from the API keys page of the Hamsa dashboard:

```javascript
const agent = new HamsaVoiceAgent({ publicKey: "pk_..." });
```

A public key is made to sit in a web page or an app. To start calls through your own server instead, see [secret keys](#starting-calls-through-your-server-secret-keys). Using an API key from before public keys? See [Moving from an API key](#moving-from-an-api-key).

### Using via CDN

Include the script from a CDN:

```html
<script src="https://unpkg.com/@hamsa-ai/voice-agents-sdk@LATEST_VERSION/dist/index.umd.js"></script>
```

The script puts the SDK on `window.HamsaVoiceAgent`, with the class inside it as `HamsaVoiceAgent.HamsaVoiceAgent` (and the error class as `HamsaVoiceAgent.HamsaApiError`):

```javascript
const agent = new HamsaVoiceAgent.HamsaVoiceAgent({ publicKey: "pk_..." });

agent.on("callStarted", ({ jobId }) => {
  console.log("Conversation has started! Job ID:", jobId);
});

// Example: Start a call
// agent.start({ agentId: 'YOUR_AGENT_ID' });
```

Make sure to replace `LATEST_VERSION` with the actual latest version number.

## Start a Conversation with an Existing Agent

Start a conversation with an existing agent by calling the "start" function. You can create and manage agents in our Dashboard or using our API (see: <https://docs.tryhamsa.com>):

```javascript
agent.start({
  agentId: YOUR_AGENT_ID,
  params: {
    param1: "NAME",
    param2: "NAME2",
  },
  userId: "user-123", // Optional user tracking
  preferHeadphonesForIosDevices: true, // iOS audio optimization
  connectionDelay: {
    android: 3000, // 3 second delay for Android
    ios: 0,
    default: 0,
  },
});
```

When creating an agent, you can add parameters to your pre-defined values. For example, you can set your Greeting Message to: "Hello {{name}}, how can I help you today?" and pass the "name" as a parameter to use the correct name of the user.

### Starting calls from your website or app: public keys

Use a **public key** (`pk_…`) from the API keys page of the Hamsa dashboard. It is safe in a page or an app: it can only start calls, and only in the environment it was made for (dev, staging or prod), running what that environment runs with its values. Give the SDK the key and nothing else; `start()` gets a short-lived call token with it and starts the call:

```javascript
const agent = new HamsaVoiceAgent({ publicKey: "pk_..." });

agent.start({ agentId: YOUR_AGENT_ID });
```

Use the staging key on your staging site and the prod key in production. A public key cannot choose a version or an environment (`versionRef` and `environmentId` are refused with it); for that, use a secret key.

### Starting calls through your server: secret keys

A **secret key** (`sk_…`) stays on your server, never in a page (the SDK refuses one in a browser). Your server mints a call token for each call, and the page gives the SDK a function that fetches it. The SDK calls the function as the call starts, so the token (which lives about 30 seconds and starts one call) is fresh:

```javascript
// Your server, with the secret key
app.post("/hamsa/call-token", async (req, res) => {
  const reply = await fetch("https://api.tryhamsa.com/v1/voice-agents/call-token", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.HAMSA_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId: "YOUR_PROJECT_ID", voiceAgentId: "YOUR_AGENT_ID" }),
  });
  res.json((await reply.json()).data);
});

// Your page, holding no key
const agent = new HamsaVoiceAgent();

agent.start({
  agentId: YOUR_AGENT_ID,
  callToken: () =>
    fetch("/hamsa/call-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => d.callToken),
});
```

Your server decides what the call runs: add `versionRef` (a version id, or `"draft"`) or `environmentId` to the mint. `callToken` also takes the token itself, for a page that already has one. With a token, `versionRef` and `environmentId` are not sent from the page: the token decides them. `getJobDetails()` needs an API key, since a token is spent starting the call.

### When a call cannot start

Refusals arrive on the `error` event as a `HamsaApiError` with a `messageKey`, the HTTP `status`, the API's `params` and a sentence that says what to do:

| `messageKey` | What it means |
| --- | --- |
| `EnvironmentNotDeployed` | The key's environment runs nothing for this agent yet (`params.environment`). |
| `KeyNotForAgent` | The key is limited to other agents. |
| `ApiKeyRateLimited` | Too many calls with this key in a minute; `retryAfter` says how many seconds to wait. |
| `KeyRotated` | The key value was replaced; use the current one. |
| `PublicKeyFixedEnvironment` | `versionRef` or `environmentId` was passed with a public key. |
| `CallTokenInvalid` | The call token was already used, or is older than about 30 seconds; get a new one for each call. |
| `CallTokenRequired` | An API key asked for a version or an environment; use a public key, or a token from your server. |

```javascript
agent.on("error", (error) => {
  if (error.messageKey === "ApiKeyRateLimited") retryIn(error.retryAfter);
});
```

With no `error` listener, `start()` rejects with the same error instead, so a `try` around `await agent.start(...)` catches it.

Already using an API key? It keeps working; see [Moving from an API key](#moving-from-an-api-key).

### Keeping a caller on one version during an A/B test

While an agent's prod runs an A/B test, each call is assigned a version by weight. Phone callers stay on one side by their number. A web call has no number, so pass `callerKey`, a stable id for your end user (1 to 200 characters), to keep them on the same version while the test lasts:

```javascript
agent.start({
  agentId: YOUR_AGENT_ID,
  callerKey: currentUser.id, // stable across visits, never a secret
});
```

Without it, each web call is assigned on its own: weighted, but not sticky.

## Pause/Resume a Conversation

To pause the conversation, call the "pause" function. This will prevent the SDK from sending or receiving new data until you resume the conversation:

```javascript
agent.pause();
```

To resume the conversation:

```javascript
agent.resume();
```

## End a Conversation

To end a conversation, simply call the "end" function:

```javascript
agent.end();
```

## Chat (Text) Conversations

The SDK supports text-only chat sessions in addition to voice. In chat mode the
SDK connects to the agent without requesting microphone access, sends the user's
typed messages to the agent, and surfaces the agent's replies (including the
greeting) as they stream in.

Start a chat-only session by passing `isChatOnly: true` to `start()`:

```javascript
const agent = new HamsaVoiceAgent({ publicKey: "pk_..." });

// Receive the agent's chat replies (streaming-aware)
agent.on('chatMessageReceived', (message) => {
  // message: { id, role: 'user' | 'agent', text, isFinal, timestamp }
  // The same `id` is reused across streaming updates of one message, so you can
  // update the same bubble in place; `isFinal` is false for partials, true when complete.
  renderMessage(message);
});

// Optional: typing indicator while the agent composes a reply
agent.on('agentStateChanged', (state) => {
  setTyping(state === 'thinking' || state === 'speaking');
});

// Start the chat-only session
await agent.start({ agentId: 'YOUR_AGENT_ID', isChatOnly: true });

// Send the user's typed message (published on the chat channel)
await agent.sendMessage('Hello, I need help with my order.');

// End the session when done
agent.end();
```

### Chat surface

| API | Purpose |
| --- | --- |
| `start({ isChatOnly: true })` | Begin a text-only session (no microphone prompt). |
| `sendMessage(text)` | Send the user's message to the agent. Emits `messageSent`. |
| `chatMessageReceived` event | Agent chat replies + greeting, with `{ id, role, text, isFinal, timestamp }`. Fires **only** for chat — never for voice transcriptions. |
| `agentStateChanged` event | Drive a typing indicator (`thinking` / `speaking`). |
| `end()` | End the chat session. |

> **Note:** Use `chatMessageReceived` for chat UIs — it is dedicated to chat and
> deterministic. It surfaces the agent's text in chat-only sessions regardless of
> the underlying delivery channel. The generic `messageReceived` event also fires
> for chat, but it is dual-sourced (it additionally fires for voice
> transcriptions), so prefer `chatMessageReceived`. In a chat-only session the
> voice events (`answerReceived`, `transcriptionReceived`) and audio events do not fire.

## Advanced Audio Controls

The SDK provides comprehensive audio control features for professional voice applications:

### Volume Management

```javascript
// Set agent voice volume (0.0 to 1.0)
agent.setVolume(0.8);

// Get current output volume
const currentVolume = agent.getOutputVolume();
console.log(`Volume: ${Math.round(currentVolume * 100)}%`);

// Get user microphone input level
const inputLevel = agent.getInputVolume();
if (inputLevel > 0.1) {
  showUserSpeakingIndicator();
}
```

### Microphone Control

```javascript
// Mute/unmute microphone
agent.setMicMuted(true);  // Mute
agent.setMicMuted(false); // Unmute

// Check mute status
if (agent.isMicMuted()) {
  showUnmutePrompt();
}

// Toggle microphone
const currentMuted = agent.isMicMuted();
agent.setMicMuted(!currentMuted);

// Listen for microphone events
agent.on('micMuted', () => {
  document.getElementById('micButton').classList.add('muted');
});

agent.on('micUnmuted', () => {
  document.getElementById('micButton').classList.remove('muted');
});
```

### Audio Visualization

Create real-time audio visualizers using frequency data:

```javascript
// Input visualizer (user's microphone)
function createInputVisualizer() {
  const canvas = document.getElementById('inputVisualizer');
  const ctx = canvas.getContext('2d');
  
  function draw() {
    const frequencyData = agent.getInputByteFrequencyData();
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width / frequencyData.length;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * canvas.height;
      ctx.fillStyle = `hsl(${i * 2}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
    }
    
    requestAnimationFrame(draw);
  }
  
  draw();
}

// Output visualizer (agent's voice)
function createOutputVisualizer() {
  const canvas = document.getElementById('outputVisualizer');
  const ctx = canvas.getContext('2d');
  
  agent.on('speaking', () => {
    function draw() {
      const frequencyData = agent.getOutputByteFrequencyData();
      
      if (frequencyData.length > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw voice characteristics
        for (let i = 0; i < frequencyData.length; i++) {
          const barHeight = (frequencyData[i] / 255) * canvas.height;
          ctx.fillStyle = `hsl(${240 + i}, 70%, 60%)`;
          ctx.fillRect(i * 2, canvas.height - barHeight, 2, barHeight);
        }
        
        requestAnimationFrame(draw);
      }
    }
    draw();
  });
}
```

### Audio Capture

Capture raw audio data from the agent or user for forwarding to third-party services, custom recording, or advanced audio processing.

The SDK provides **three levels of API** for different use cases:

#### Level 1: Simple Callback (Recommended for Most Users)

The easiest way - just pass a callback to `start()`:

```javascript
// Dead simple - captures agent audio automatically
await agent.start({
  agentId: 'agent-123',
  onAudioData: (audioData) => {
    // Send to third-party service
    thirdPartyWebSocket.send(audioData);
  }
});
```

This automatically:
- ✅ Captures **agent audio** only
- ✅ Uses **opus-webm** format (efficient, compressed)
- ✅ Delivers **100ms chunks** (good balance of latency/efficiency)
- ✅ Starts immediately when call connects
- ✅ No timing issues or event handling needed

#### Level 2: Inline Configuration

Need more control? Use `captureAudio` options:

```javascript
await agent.start({
  agentId: 'agent-123',
  captureAudio: {
    source: 'both',       // Capture both agent and user
    format: 'pcm-f32',    // Raw PCM for processing
    bufferSize: 4096,
    onData: (audioData, metadata) => {
      if (metadata.source === 'agent') {
        processAgentAudio(audioData);
      } else {
        processUserAudio(audioData);
      }
    }
  }
});
```

#### Level 3: Dynamic Control

For advanced users who need runtime control:

```javascript
// Start without capture
await agent.start({
  agentId: 'agent-123'
});

// Enable capture later, conditionally
if (userWantsRecording) {
  agent.enableAudioCapture({
    source: 'agent',
    format: 'opus-webm',
    chunkSize: 100,
    callback: (audioData, metadata) => {
      thirdPartyWebSocket.send(audioData);
    }
  });
}

// Disable when done
agent.disableAudioCapture();
```

#### Audio Capture Formats

The SDK supports three high-quality audio formats:

1. **`opus-webm`** (default, recommended)
   - Efficient Opus codec in WebM container
   - Small file size, good quality
   - Best for forwarding to services or recording
   - `audioData` is an `ArrayBuffer`

2. **`pcm-f32`**
   - Raw PCM audio as Float32Array
   - Values range from -1.0 to 1.0 (16kHz mono)
   - Best for audio analysis or DSP
   - `audioData` is a `Float32Array`

3. **`pcm-i16`**
   - Raw PCM audio as Int16Array
   - Values range from -32768 to 32767
   - Best for compatibility with legacy audio APIs
   - `audioData` is an `Int16Array`

#### Common Use Cases

**Forward agent audio to third-party service:**
```javascript
const socket = new WebSocket('wss://your-service.com/audio');

agent.enableAudioCapture({
  source: 'agent',
  format: 'opus-webm',
  chunkSize: 100,
  callback: (audioData, metadata) => {
    socket.send(audioData);
  }
});
```

**Capture both agent and user audio:**
```javascript
agent.enableAudioCapture({
  source: 'both',
  format: 'opus-webm',
  chunkSize: 100,
  callback: (audioData, metadata) => {
    if (metadata.source === 'agent') {
      processAgentAudio(audioData);
    } else {
      processUserAudio(audioData);
    }
  }
});
```

**Advanced: Custom audio analysis with PCM:**
```javascript
agent.enableAudioCapture({
  source: 'agent',
  format: 'pcm-f32',
  bufferSize: 4096,
  callback: (audioData, metadata) => {
    const samples = audioData; // Float32Array

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);

    console.log('Agent voice level:', rms);

    // Apply custom DSP, analyze frequencies, etc.
    customAudioProcessor.process(samples, metadata.sampleRate);
  }
});
```

**Real-time transcription:**
```javascript
const transcriptionWS = new WebSocket('wss://transcription-service.com');

agent.enableAudioCapture({
  source: 'user',
  format: 'opus-webm',
  chunkSize: 50, // Lower latency
  callback: (audioData, metadata) => {
    transcriptionWS.send(JSON.stringify({
      audio: Array.from(new Uint8Array(audioData)),
      timestamp: metadata.timestamp,
      participant: metadata.participant
    }));
  }
});
```

**TypeScript support:**
```typescript
import { AudioCaptureOptions, AudioCaptureMetadata } from '@hamsa-ai/voice-agents-sdk';

const options: AudioCaptureOptions = {
  source: 'agent',
  format: 'pcm-f32',
  bufferSize: 4096,
  callback: (audioData: Float32Array | Int16Array | ArrayBuffer, metadata: AudioCaptureMetadata) => {
    console.log('Audio captured:', {
      participant: metadata.participant,
      source: metadata.source,        // 'agent' | 'user'
      trackId: metadata.trackId,
      timestamp: metadata.timestamp,
      sampleRate: metadata.sampleRate,  // For PCM formats
      channels: metadata.channels,      // For PCM formats
      format: metadata.format
    });
  }
};

agent.enableAudioCapture(options);
```


## Advanced Configuration Options

### Platform-Specific Optimizations

```javascript
agent.start({
  agentId: "your-agent-id",
  
  // Optimize audio for iOS devices
  preferHeadphonesForIosDevices: true,
  
  // Platform-specific delays to prevent audio cutoff
  connectionDelay: {
    android: 3000, // Android needs longer delay for audio mode switching
    ios: 500,      // Shorter delay for iOS
    default: 1000  // Default for other platforms
  },
  
  // Disable wake lock for battery optimization
  disableWakeLock: false,
  
  // User tracking
  userId: "customer-12345"
});
```

## Job/Call ID Tracking

Track and reference conversations using unique job IDs. The SDK provides two ways to access the job/call ID:

### Getting Job ID from Events (Recommended)

The `callStarted` event includes the job ID in its data object:

```javascript
agent.on("callStarted", ({ jobId }) => {
  console.log("Call started with ID:", jobId);

  // Send to analytics service
  analytics.trackCall(jobId);

  // Store for later reference
  localStorage.setItem("lastCallId", jobId);
});
```

### Getting Job ID with Getter Method

Access the job ID anytime after the call has started:

```javascript
// Get current job ID
const jobId = agent.getJobId();

if (jobId) {
  console.log("Current call ID:", jobId);
} else {
  console.log("No active call");
}

// Use in other events
agent.on("transcriptionReceived", (text) => {
  const jobId = agent.getJobId();
  saveTranscript(jobId, text);
});

// Check completion status later
agent.on("callEnded", async () => {
  const jobId = agent.getJobId();
  if (jobId) {
    const details = await agent.getJobDetails();
    console.log("Call completed:", details);
  }
});
```

### TypeScript Support

```typescript
import { CallStartedData } from '@hamsa-ai/voice-agents-sdk';

// Event-based (with destructuring)
agent.on("callStarted", ({ jobId }: CallStartedData) => {
  console.log("Job ID:", jobId); // string
});

// Getter-based
const jobId: string | null = agent.getJobId();
```

## Events

During the conversation, the SDK emits events to update your application about the conversation status.

### Conversation Status Events

```javascript
agent.on("callStarted", ({ jobId }) => {
  console.log("Conversation has started with ID:", jobId);
});
agent.on("callEnded", () => {
  console.log("Conversation has ended!");
});
agent.on("callPaused", () => {
  console.log("The conversation is paused");
});
agent.on("callResumed", () => {
  console.log("Conversation has resumed");
});
```

### Agent Status Events

```javascript
agent.on("speaking", () => {
  console.log("The agent is speaking");
});
agent.on("listening", () => {
  console.log("The agent is listening");
});

// Unified agent state change event
agent.on("agentStateChanged", (state) => {
  console.log("Agent state:", state);
  // state can be: 'idle', 'initializing', 'listening', 'thinking', 'speaking'
});
```

### Conversation Script Events

```javascript
agent.on("transcriptionReceived", (text) => {
  console.log("User speech transcription received", text);
});
agent.on("answerReceived", (text) => {
  console.log("Agent answer received", text);
});
// Chat-only sessions: dedicated chat event (see "Chat (Text) Conversations")
agent.on("chatMessageReceived", (message) => {
  console.log("Chat message received", message); // { id, role, text, isFinal, timestamp }
});
```

### Error Events

```javascript
agent.on("closed", () => {
  console.log("Conversation was closed");
});
agent.on("error", (e) => {
  console.log("Error was received", e);
});
```

### Advanced Analytics Events

The SDK provides comprehensive analytics for monitoring call quality, performance, and custom agent events:

```javascript
// Real-time connection quality updates
agent.on("connectionQualityChanged", ({ quality, participant, metrics }) => {
  console.log(`Connection quality: ${quality}`, metrics);
});

// Periodic analytics updates (every second during calls)
agent.on("analyticsUpdated", (analytics) => {
  console.log("Call analytics:", analytics);
  // Contains: connectionStats, audioMetrics, performanceMetrics, etc.
});

// Participant events
agent.on("participantConnected", (participant) => {
  console.log("Participant joined:", participant.identity);
});

agent.on("participantDisconnected", (participant) => {
  console.log("Participant left:", participant.identity);
});

// Track subscription events (audio/video streams)
agent.on("trackSubscribed", ({ track, participant, trackStats }) => {
  console.log("New track:", track.kind, "from", participant);
});

agent.on("trackUnsubscribed", ({ track, participant }) => {
  console.log("Track ended:", track.kind, "from", participant);
});

// Connection state changes
agent.on("reconnecting", () => {
  console.log("Attempting to reconnect...");
});

agent.on("reconnected", () => {
  console.log("Successfully reconnected");
});

// Custom events from agents
agent.on("customEvent", (eventType, eventData, metadata) => {
  console.log(`Custom event: ${eventType}`, eventData);
  // Examples: flow_navigation, tool_execution, agent_state_change
});
```

## Analytics & Monitoring

The SDK provides comprehensive real-time analytics for monitoring call quality, performance metrics, and custom agent events. Access analytics data through both synchronous methods and event-driven updates.

### Analytics Architecture

The SDK uses a clean modular design with four specialized components:

- **Connection Management**: Handles room connections, participants, and network state
- **Analytics Engine**: Processes WebRTC statistics and performance metrics
- **Audio Management**: Manages audio tracks, volume control, and quality monitoring
- **Tool Registry**: Handles RPC method registration and client-side tool execution

Access analytics data through both synchronous methods and event-driven updates.

### Synchronous Analytics Methods

Get real-time analytics data instantly for dashboards and monitoring:

```javascript
// Connection quality and network statistics
const connectionStats = agent.getConnectionStats();
console.log(connectionStats);
/*
{
  quality: 'good',         // Connection quality: excellent/good/poor/lost
  connectionAttempts: 1,   // Total connection attempts
  reconnectionAttempts: 0, // Reconnection attempts
  connectionEstablishedTime: 250, // Time to establish connection (ms)
  isConnected: true        // Current connection status
}
*/

// Audio levels and quality metrics
const audioLevels = agent.getAudioLevels();
console.log(audioLevels);
/*
{
  userAudioLevel: 0.8,         // Current user audio level
  agentAudioLevel: 0.3,        // Current agent audio level
  userSpeakingTime: 30000,     // User speaking duration (ms)
  agentSpeakingTime: 20000,    // Agent speaking duration (ms)
  audioDropouts: 0,            // Audio interruption count
  echoCancellationActive: true,// Echo cancellation status
  volume: 1.0,                 // Current volume setting
  isPaused: false              // Pause state
}
*/

// Performance metrics
const performance = agent.getPerformanceMetrics();
console.log(performance);
/*
{
  responseTime: 1200,          // Total response time
  callDuration: 60000,         // Current call duration (ms)
  connectionEstablishedTime: 250, // Time to establish connection
  reconnectionCount: 0,        // Number of reconnections
  averageResponseTime: 1200    // Average response time
}
*/

// Participant information
const participants = agent.getParticipants();
console.log(participants);
/*
[
  {
    identity: "agent",
    sid: "participant-sid",
    connectionTime: 1638360000000,
    metadata: "agent-metadata"
  }
]
*/

// Track statistics (audio/video streams)
const trackStats = agent.getTrackStats();
console.log(trackStats);
/*
{
  totalTracks: 2,
  activeTracks: 2,
  audioElements: 1,
  trackDetails: [
    ["track-id", { trackId: "track-id", kind: "audio", participant: "agent" }]
  ]
}
*/

// Complete analytics snapshot
const analytics = agent.getCallAnalytics();
console.log(analytics);
/*
{
  connectionStats: { quality: 'good', connectionAttempts: 1, isConnected: true, ... },
  audioMetrics: { userAudioLevel: 0.8, agentAudioLevel: 0.3, ... },
  performanceMetrics: { callDuration: 60000, responseTime: 1200, ... },
  participants: [{ identity: 'agent', sid: 'participant-sid', ... }],
  trackStats: { totalTracks: 2, activeTracks: 2, ... },
  callStats: { connectionAttempts: 1, packetsLost: 0, ... },
  metadata: {
    callStartTime: 1638360000000,
    isConnected: true,
    isPaused: false,
    volume: 1.0
  }
}
*/
```

### Real-time Dashboard Example

Build live monitoring dashboards using the analytics data:

```javascript
// Update dashboard every second
const updateDashboard = () => {
  const stats = agent.getConnectionStats();
  const audio = agent.getAudioLevels();
  const performance = agent.getPerformanceMetrics();

  // Update UI elements
  document.getElementById("quality").textContent = stats.quality;
  document.getElementById("attempts").textContent = stats.connectionAttempts;
  document.getElementById("duration").textContent = `${Math.floor(
    performance.callDuration / 1000
  )}s`;
  document.getElementById("user-audio").style.width = `${
    audio.userAudioLevel * 100
  }%`;
  document.getElementById("agent-audio").style.width = `${
    audio.agentAudioLevel * 100
  }%`;
};

// Start dashboard updates when call begins
agent.on("callStarted", () => {
  const dashboardInterval = setInterval(updateDashboard, 1000);

  agent.on("callEnded", () => {
    clearInterval(dashboardInterval);
  });
});
```

### Custom Event Tracking

Track custom events from your voice agents:

```javascript
agent.on("customEvent", (eventType, eventData, metadata) => {
  switch (eventType) {
    case "flow_navigation":
      console.log("Agent navigated:", eventData.from, "->", eventData.to);
      // Track conversation flow
      break;

    case "tool_execution":
      console.log(
        "Tool called:",
        eventData.toolName,
        "Result:",
        eventData.success
      );
      // Monitor tool usage
      break;

    case "agent_state_change":
      console.log("Agent state:", eventData.state);
      // Track agent behavior
      break;

    case "user_intent_detected":
      console.log(
        "User intent:",
        eventData.intent,
        "Confidence:",
        eventData.confidence
      );
      // Analyze user intent
      break;

    default:
      console.log("Custom event:", eventType, eventData);
  }
});
```

## Configuration Options

The SDK accepts optional configuration parameters:

```javascript
const agent = new HamsaVoiceAgent({
  publicKey: "pk_...",
  API_URL: "https://api.tryhamsa.com", // API endpoint (default)
});
```

## Client-Side Tools

You can register client-side tools that the agent can call during conversations:

```javascript
const tools = [
  {
    function_name: "getUserInfo",
    description: "Get user information",
    parameters: [
      {
        name: "userId",
        type: "string",
        description: "User ID to look up",
      },
    ],
    required: ["userId"],
    fn: async (userId) => {
      // Your tool implementation
      const userInfo = await fetchUserInfo(userId);
      return userInfo;
    },
  },
];

agent.start({
  agentId: "YOUR_AGENT_ID",
  tools: tools,
  voiceEnablement: true,
});
```

`voiceEnablement: true` turns on these page tools for the call: tools that run in the page (opening the cart, for example) rather than calling an HTTP endpoint. A voice call does not need it; leave it out when you register no tools.

## Migration from Previous Versions

### Moving from an API key

An API key passed as `new HamsaVoiceAgent(API_KEY)` keeps working: its calls reach what your agent runs in prod, as before. Move when you can. Anyone who opens your page can read a key in it, and an API key can do much more than start calls. A public key can only start calls, in the one environment it was made for.

1. On the API keys page of the Hamsa dashboard, create a public key for prod, for your live site. You can limit it to some agents, and to your domains.
2. Update the SDK: public keys need 0.6.4-beta.3 or later.
3. Pass the key as `publicKey`. Options you already pass go in the same object:

   ```javascript
   // Before
   const agent = new HamsaVoiceAgent(API_KEY, { region: "uae" });

   // After
   const agent = new HamsaVoiceAgent({ publicKey: "pk_...", region: "uae" });
   ```

   `start()` and everything after it stay the same.

4. Once your site runs on the public key, delete the API key in the dashboard if nothing else uses it.

What works differently:

- **Staging and dev.** A public key reaches only its own environment. Give your staging site a staging key to try a version there before prod.
- **Choosing a version.** A page cannot pass `versionRef` or `environmentId` with any key. To choose per call, mint call tokens on your server with a [secret key](#starting-calls-through-your-server-secret-keys).
- **`getJobDetails()`** still needs an API key, so it belongs on your server.

### Older versions of the SDK

If you're upgrading from a previous version, see the [Migration Guide](./MIGRATION_GUIDE.md) for detailed instructions. Connection details are now automatically managed and no longer need to be configured.

## Browser Compatibility

This SDK supports modern browsers with WebRTC capabilities:

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## TypeScript Support

The SDK includes comprehensive TypeScript definitions with detailed analytics interfaces:

```typescript
import {
  HamsaVoiceAgent,
  AgentState,
  AudioCaptureOptions,
  AudioCaptureMetadata,
  CallAnalyticsResult,
  CallStartedData,
  ParticipantData,
  CustomEventMetadata,
} from "@hamsa-ai/voice-agents-sdk";

// All analytics methods return strongly typed data
const agent = new HamsaVoiceAgent({ publicKey: "pk_..." });

// TypeScript will provide full autocomplete and type checking for all methods
const connectionStats = agent.getConnectionStats(); // ConnectionStatsResult | null
const audioLevels = agent.getAudioLevels(); // AudioLevelsResult | null
const performance = agent.getPerformanceMetrics(); // PerformanceMetricsResult | null
const participants = agent.getParticipants(); // ParticipantData[]
const trackStats = agent.getTrackStats(); // TrackStatsResult | null
const analytics = agent.getCallAnalytics(); // CallAnalyticsResult | null

// Job ID access
const jobId = agent.getJobId(); // string | null

// Advanced audio control methods
const outputVolume = agent.getOutputVolume(); // number
const inputVolume = agent.getInputVolume(); // number
const isMuted = agent.isMicMuted(); // boolean
const inputFreqData = agent.getInputByteFrequencyData(); // Uint8Array
const outputFreqData = agent.getOutputByteFrequencyData(); // Uint8Array

// Audio capture with full type safety
agent.enableAudioCapture({
  source: 'agent',
  format: 'opus-webm',
  chunkSize: 100,
  callback: (audioData: ArrayBuffer | Float32Array | Int16Array, metadata: AudioCaptureMetadata) => {
    // Full TypeScript autocomplete for metadata
    console.log(metadata.participant); // string
    console.log(metadata.source);      // 'agent' | 'user'
    console.log(metadata.timestamp);   // number
    console.log(metadata.trackId);     // string
    console.log(metadata.sampleRate);  // number | undefined
  }
});

// Strongly typed start options with all advanced features
await agent.start({
  agentId: "agent-id",
  voiceEnablement: true, // only with page tools (tools: [...])
  userId: "user-123",
  params: {
    userName: "John Doe",
    sessionId: "session-456"
  },
  preferHeadphonesForIosDevices: true,
  connectionDelay: {
    android: 3000,
    ios: 500,
    default: 1000
  },
  disableWakeLock: false
});

// Strongly typed event handlers
agent.on("callStarted", ({ jobId }: CallStartedData) => {
  console.log("Job ID:", jobId); // string
  // Track conversation start
});

agent.on("analyticsUpdated", (analytics: CallAnalyticsResult) => {
  console.log(analytics.connectionStats.quality); // string
  console.log(analytics.audioMetrics.userAudioLevel); // number
  console.log(analytics.performanceMetrics.callDuration); // number
  console.log(analytics.participants.length); // number
});

// Audio control events
agent.on("micMuted", () => {
  console.log("Microphone was muted");
});

agent.on("micUnmuted", () => {
  console.log("Microphone was unmuted");
});

// Agent state tracking with type safety
agent.on("agentStateChanged", (state: AgentState) => {
  console.log("Agent state:", state); // 'idle' | 'initializing' | 'listening' | 'thinking' | 'speaking'

  // TypeScript provides autocomplete and type checking
  if (state === 'thinking') {
    showThinkingIndicator();
  }
});

// Strongly typed custom events
agent.on(
  "customEvent",
  (eventType: string, eventData: any, metadata: CustomEventMetadata) => {
    console.log(metadata.timestamp); // number
    console.log(metadata.participant); // string
  }
);

// Strongly typed participant events
agent.on("participantConnected", (participant: ParticipantData) => {
  console.log(participant.identity); // string
  console.log(participant.connectionTime); // number
});
```

## Use Cases

### Agent State UI Updates

```javascript
agent.on("agentStateChanged", (state) => {
  // Update UI based on agent state
  const statusElement = document.getElementById("agent-status");

  switch (state) {
    case 'idle':
      statusElement.textContent = "Agent is idle";
      statusElement.className = "status-idle";
      break;
    case 'initializing':
      statusElement.textContent = "Agent is starting...";
      statusElement.className = "status-initializing";
      break;
    case 'listening':
      statusElement.textContent = "Agent is listening";
      statusElement.className = "status-listening";
      showMicrophoneAnimation();
      break;
    case 'thinking':
      statusElement.textContent = "Agent is thinking...";
      statusElement.className = "status-thinking";
      showThinkingAnimation();
      break;
    case 'speaking':
      statusElement.textContent = "Agent is speaking";
      statusElement.className = "status-speaking";
      showSpeakerAnimation();
      break;
  }
});
```

### Real-time Call Quality Monitoring

```javascript
agent.on("connectionQualityChanged", ({ quality, metrics }) => {
  if (quality === "poor") {
    showNetworkWarning();
    logQualityIssue(metrics);
  }
});
```

### Analytics Dashboard

```javascript
const analytics = agent.getCallAnalytics();
sendToAnalytics({
  callDuration: analytics.callDuration,
  audioQuality: analytics.audioMetrics,
  participantCount: analytics.participants.length,
  performance: analytics.performanceMetrics,
});
```

### Conversation Flow Analysis

```javascript
agent.on("customEvent", (eventType, data) => {
  if (eventType === "flow_navigation") {
    trackConversationFlow(data.from, data.to);
    optimizeAgentResponses(data);
  }
});
```

## Dependencies

- **livekit-client v2.15.4**: Real-time communication infrastructure
- **events v3.3.0**: EventEmitter for browser compatibility

The SDK uses LiveKit's native WebRTC capabilities for high-quality real-time audio communication and comprehensive analytics.
