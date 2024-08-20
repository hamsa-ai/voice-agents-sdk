# Hamsa Voice Agent Web SDK

Hamsa Voice Agent Web SDK is a JavaScript library for running voice agent from https://dashboard.tryhamsa.com. This SDK provides a seamless way to integrate voice interactions into your web applications.


## Installation
You can install the SDK via npm:

```bash
npm install hamsa-voice-agents
```
## Usage

You should first import the package in your code

```javascript
import { HamsaVoiceAgent } from 'hamsa-voice-agents';
```

After importing the package, you need to initialize it with your API_KEY. To get your first API_KEY visit https://dashboard.tryhamsa.com

```javascript
const agent = new HamsaVoiceAgent(API_KEY);
```

## Start a conversation with exsiting agent

You can easily start a conversation with existing agent by calling "start" function, You can create a new agent and manage your agents in our Dashboard, or using our API see: https://docs.tryhamsa.com

```javascript
agent.start({
    agentId: YOUR_AGENT_ID,
    params: {
        param1: "NAME",
        param2: "NAME2"
    }
})
```

When you create an agent, you can add params to your pre-defined values, for example you can set your Greeting Message to: "Hello {{name}}, how can I help you today?" and you pass the "name" as a parameter to override it and say the correct name of the user.

## Pause/Resume a conversation

If you want to pause the conversation, you can call "pause" function, this will block the SDK from sending or recieving new data, until you resume the conversation.

```javascript
agent.pause()
```

```javascript
agent.resume()
```

## End a conversation

To end a conversation you simply call "end" function.

```javascript
agent.end()
```

## Events

During the conversation the SDK emits events to update your application about the conversation status.

### Conversation status events

```javascript
agent.on("callStarted", () => { console.log("Conversation has started!") })
agent.on("callEnded", () => { console.log("Conversation has ended!") })
agent.on("callPaused", () => { console.log("The conversation is paused") })
agent.on("callResumes", () => { console.log("Conversation has resumed") })
```

### Agent Status events

```javascript
agent.on("speaking", () => { console.log("The agent is speaking") })
agent.on("listening", () => { console.log("The agent is listening") })
```

### Conversation script events

```javascript
agent.on("transcriptionReceived", (text) => { console.log("User speech transcription recieved", text) })
agent.on("answerReceived", (text) => { console.log("Agent answer received", text) })
```

### Error events

```javascript
agent.on("close", () => { console.log("Conversation was closed") })
agent.on("error", (e) => { console.log("Error was received", e) })
```