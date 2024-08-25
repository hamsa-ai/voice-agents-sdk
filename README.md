# Hamsa Voice Agents Web SDK

Hamsa Voice Agents Web SDK is a JavaScript library for integrating voice agents from https://dashboard.tryhamsa.com. This SDK provides a seamless way to incorporate voice interactions into your web applications.

## Installation

Install the SDK via npm:

```bash
npm i @hamsa-ai/voice-agents-sdk
```

## Usage

First, import the package in your code:

```javascript
import { HamsaVoiceAgent } from 'hamsa-voice-agents';
```

Initialize the SDK with your API key. 
To obtain your first API key, visit https://dashboard.tryhamsa.com

```javascript
const agent = new HamsaVoiceAgent(API_KEY);
```

## Start a Conversation with an Existing Agent

Start a conversation with an existing agent by calling the "start" function. You can create and manage agents in our Dashboard or using our API (see: https://docs.tryhamsa.com):

```javascript
agent.start({
    agentId: YOUR_AGENT_ID,
    params: {
        param1: "NAME",
        param2: "NAME2"
    }
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

## Events

During the conversation, the SDK emits events to update your application about the conversation status.

### Conversation Status Events

```javascript
agent.on("callStarted", () => { console.log("Conversation has started!"); });
agent.on("callEnded", () => { console.log("Conversation has ended!"); });
agent.on("callPaused", () => { console.log("The conversation is paused"); });
agent.on("callResumed", () => { console.log("Conversation has resumed"); });
```

### Agent Status Events

```javascript
agent.on("speaking", () => { console.log("The agent is speaking"); });
agent.on("listening", () => { console.log("The agent is listening"); });
```

### Conversation Script Events

```javascript
agent.on("transcriptionReceived", (text) => { console.log("User speech transcription received", text); });
agent.on("answerReceived", (text) => { console.log("Agent answer received", text); });
```

### Error Events

```javascript
agent.on("closed", () => { console.log("Conversation was closed"); });
agent.on("error", (e) => { console.log("Error was received", e); });
```