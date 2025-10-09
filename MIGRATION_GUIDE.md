# SDK v0.4.0 Migration Guide

This guide helps you migrate to the latest version of the Hamsa Voice Agents SDK, which includes significant improvements to reliability, audio quality, and performance.

## What Changed

The SDK has been updated with a new underlying communication infrastructure that provides:

- **Better reliability** with improved connection handling
- **Enhanced audio quality** and lower latency
- **Better error handling** and automatic reconnection
- **Future extensibility** for advanced features
- **Simplified configuration** - less setup required

## Breaking Changes

### Configuration Simplification

Connection details are now managed automatically and no longer need to be configured:

**Before:**

```javascript
const voiceAgent = new HamsaVoiceAgent(apiKey, {
  WS_URL: "wss://your-websocket-server.com",
});
```

**After:**

```javascript
const voiceAgent = new HamsaVoiceAgent(apiKey);
// Connection infrastructure is automatically managed by Hamsa
```

## What Stays the Same

### Public API

All existing public methods remain unchanged:

- `start(options)` - Start a voice conversation
- `end()` - End the conversation
- `pause()` - Pause the conversation
- `resume()` - Resume the conversation
- `setVolume(volume)` - Set audio volume
- `getJobDetails()` - Get conversation details

### New Audio Control Methods

Enhanced audio capabilities are now available:

- `getOutputVolume()` - Get current speaker volume (0.0-1.0)
- `getInputVolume()` - Get real-time microphone input level
- `setMicMuted(muted)` - Mute/unmute the microphone
- `isMicMuted()` - Check if microphone is muted
- `getInputByteFrequencyData()` - Get microphone frequency analysis data
- `getOutputByteFrequencyData()` - Get speaker frequency analysis data

### Enhanced Start Options

The `start()` method now supports additional platform-specific options:

```javascript
await voiceAgent.start({
  agentId: "your-agent-id",
  userId: "user-12345", // Optional user identifier
  preferHeadphonesForIosDevices: true, // iOS audio routing
  connectionDelay: { // Platform-specific delays
    android: 3000,
    ios: 500,
    default: 1000
  },
  disableWakeLock: false, // Screen wake lock control
  // ... existing options
});
```

### Events

All events continue to work exactly the same:

- `callStarted` - When call begins
- `callEnded` - When call ends
- `callPaused` - When call is paused
- `callResumed` - When call is resumed
- `speaking` - When agent starts speaking
- `listening` - When agent stops speaking
- `transcriptionReceived` - When transcription is available
- `answerReceived` - When agent response is received
- `info` - When info messages are received
- `error` - When errors occur
- `remoteAudioStreamAvailable` - When remote audio stream is ready
- `localAudioStreamAvailable` - When local audio stream is ready

### New Analytics Events (Optional)

The new version includes comprehensive analytics events that are completely optional to use:

- `analyticsUpdated` - Real-time analytics data (every second)
- `connectionQualityChanged` - Connection quality updates
- `participantConnected` - When participants join
- `participantDisconnected` - When participants leave
- `trackSubscribed` - When audio/video tracks are added
- `trackUnsubscribed` - When tracks are removed
- `reconnecting` - When attempting to reconnect
- `reconnected` - When successfully reconnected
- `customEvent` - Custom events from agents

### New Analytics Methods (Optional)

New synchronous methods for real-time analytics data:

- `getConnectionStats()` - Connection quality and network statistics
- `getAudioLevels()` - Audio levels and quality metrics
- `getPerformanceMetrics()` - Performance and timing data
- `getParticipants()` - Participant information
- `getTrackStats()` - Track statistics and details
- `getCallAnalytics()` - Comprehensive analytics snapshot

### Tool Integration

Client-side tools continue to work the same way:

```javascript
const tools = [
  {
    function_name: "getUserInfo",
    description: "Get user information",
    parameters: [
      {
        name: "userId",
        type: "string",
        description: "User ID",
      },
    ],
    required: ["userId"],
    fn: async (userId) => {
      // Your tool implementation
      return { name: "John Doe", id: userId };
    },
  },
];

await voiceAgent.start({
  agentId: "your-agent-id",
  tools: tools,
  voiceEnablement: true,
});
```

## Migration Steps

### 1. Simplify Configuration

Remove the WebSocket URL configuration as connection details are now managed automatically:

```javascript
// Before
const voiceAgent = new HamsaVoiceAgent("your-api-key", {
  WS_URL: "wss://your-old-websocket.com",
});

// After
const voiceAgent = new HamsaVoiceAgent("your-api-key");
// Connection details are automatically managed by Hamsa
```

### 2. Test Your Integration

Run your existing code to ensure everything works as expected. The migration should be seamless for client-side code.

## Troubleshooting

### Common Issues

**Issue: "Connection failed"**

- Connection details are automatically managed by Hamsa
- Verify your API key is correct and active
- Ensure your network allows WebRTC connections

**Issue: "Error in initializing the call"**

- Verify your API key is correct
- Ensure you have sufficient balance in your Hamsa account
- Check that your agent ID is valid

**Issue: Audio not working**

- The SDK handles audio permissions automatically
- Check browser console for any WebRTC-related errors
- Ensure your browser supports modern audio features

### Getting Help

If you encounter issues during migration:

1. Check the browser console for detailed error messages
2. Verify your API key and account balance
3. Test with a minimal configuration to isolate issues
4. Contact support with specific error messages and configuration details

## Benefits of the Migration

After migration, you'll benefit from:

- **Improved reliability** with enhanced connection handling and LiveKit infrastructure
- **Better audio quality** with real-time WebAudio API integration
- **Advanced audio controls** - volume monitoring, mute controls, frequency analysis
- **Platform optimizations** - iOS headphone routing, connection delays, wake lock management
- **Lower latency** through optimized real-time protocols
- **Enhanced error handling** and automatic reconnection
- **Comprehensive analytics** for monitoring and performance tracking
- **Real-time monitoring** of call quality, performance, and custom events
- **TypeScript support** with full type definitions
- **Future-ready architecture** for advanced features
- **Reduced maintenance** with simplified configuration

### New Analytics Capabilities

The new version provides extensive monitoring and analytics features:

- **Real-time call quality monitoring** - Track latency, packet loss, connection quality
- **Audio analytics** - Monitor audio levels, speaking time, dropouts
- **Performance metrics** - Response times, connection establishment, call duration
- **Event tracking** - Custom events for tracking conversation flows and agent behavior
- **Participant tracking** - Monitor who joins and leaves conversations
- **Synchronous data access** - Get analytics data instantly for dashboards
- **Event-driven updates** - Real-time updates for live monitoring systems

Example of new capabilities:

```javascript
// Real-time quality monitoring
agent.on("connectionQualityChanged", ({ quality, metrics }) => {
  if (quality === "poor") {
    console.warn("Connection quality degraded", metrics);
    // Trigger alerts or fallback behavior
  }
});

// Live dashboard data
const updateDashboard = () => {
  const analytics = agent.getCallAnalytics();
  // Update dashboard with real-time call data
};
```

The migration maintains complete backward compatibility while providing a more robust foundation for voice agent interactions and comprehensive monitoring capabilities.
