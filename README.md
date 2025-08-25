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

Initialize the SDK with your API key:

```javascript
const agent = new HamsaVoiceAgent(API_KEY);
```

### Using via CDN

Include the script from a CDN:

```html
<script src="https://unpkg.com/@hamsa-ai/voice-agents-sdk@LATEST_VERSION/dist/index.umd.js"></script>
```

Then, you can initialize the agent like this:

```javascript
const agent = new HamsaVoiceAgent("YOUR_API_KEY");

agent.on("callStarted", () => {
  console.log("Conversation has started!");
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
  voiceEnablement: true,
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

## Events

During the conversation, the SDK emits events to update your application about the conversation status.

### Conversation Status Events

```javascript
agent.on("callStarted", () => {
  console.log("Conversation has started!");
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
```

### Conversation Script Events

```javascript
agent.on("transcriptionReceived", (text) => {
  console.log("User speech transcription received", text);
});
agent.on("answerReceived", (text) => {
  console.log("Agent answer received", text);
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
  latency: 45,              // Network latency in ms
  packetLoss: 0.1,         // Packet loss percentage
  bandwidth: 128000,       // Current bandwidth usage
  quality: 'good',         // Connection quality: excellent/good/poor/lost
  jitter: 2,               // Network jitter
  connectionAttempts: 1,   // Total connection attempts
  reconnectionAttempts: 0, // Reconnection attempts
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
  networkLatency: 45,          // Network round-trip time
  callDuration: 60000,         // Current call duration (ms)
  connectionEstablishedTime: 250, // Time to establish connection
  reconnectionCount: 0         // Number of reconnections
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
  connectionStats: { latency: 45, packetLoss: 0.1, quality: 'good', ... },
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
  document.getElementById("latency").textContent = `${stats.latency}ms`;
  document.getElementById("quality").textContent = stats.quality;
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
const agent = new HamsaVoiceAgent("YOUR_API_KEY", {
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

## Migration from Previous Versions

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
  CallAnalyticsResult,
  ParticipantData,
  CustomEventMetadata,
} from "@hamsa-ai/voice-agents-sdk";

// All analytics methods return strongly typed data
const agent = new HamsaVoiceAgent("API_KEY");

// TypeScript will provide full autocomplete and type checking for all methods
const connectionStats = agent.getConnectionStats(); // ConnectionStatsResult | null
const audioLevels = agent.getAudioLevels(); // AudioLevelsResult | null
const performance = agent.getPerformanceMetrics(); // PerformanceMetricsResult | null
const participants = agent.getParticipants(); // ParticipantData[]
const trackStats = agent.getTrackStats(); // TrackStatsResult | null
const analytics = agent.getCallAnalytics(); // CallAnalyticsResult | null

// Advanced audio control methods
const outputVolume = agent.getOutputVolume(); // number
const inputVolume = agent.getInputVolume(); // number
const isMuted = agent.isMicMuted(); // boolean
const inputFreqData = agent.getInputByteFrequencyData(); // Uint8Array
const outputFreqData = agent.getOutputByteFrequencyData(); // Uint8Array

// Strongly typed start options with all advanced features
await agent.start({
  agentId: "agent-id",
  voiceEnablement: true,
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
agent.on("analyticsUpdated", (analytics: CallAnalyticsResult) => {
  console.log(analytics.connectionStats.latency); // number
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
