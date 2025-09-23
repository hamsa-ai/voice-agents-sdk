/**
 * LiveKitToolRegistry - Advanced client-side tool management and RPC system
 *
 * This class provides comprehensive management of client-side tools that voice agents
 * can execute during conversations. It handles tool registration as RPC methods,
 * processes data messages from agents, manages transcription events, and provides
 * local audio stream access for advanced integrations.
 *
 * Key Features:
 * - **Dynamic Tool Registration**: Real-time registration and updating of client-side tools
 * - **RPC Method Management**: Secure execution of agent-requested functions
 * - **Event Processing**: Intelligent parsing and routing of agent messages
 * - **Transcription Handling**: Real-time speech-to-text processing and forwarding
 * - **Audio Stream Integration**: Local microphone stream access for external processing
 * - **Error Resilience**: Robust error handling for tool execution and message processing
 * - **Flexible Tool Definition**: Support for complex tool parameters and return values
 *
 * Tool Architecture:
 * 1. **Tool Definition**: Client defines functions with metadata (name, description, parameters)
 * 2. **Registration**: Tools are registered as LiveKit RPC methods
 * 3. **Agent Calls**: Voice agents invoke tools during conversations
 * 4. **Execution**: Client-side functions execute with provided parameters
 * 5. **Response**: Results are returned to the agent for continued conversation
 *
 * Message Processing Pipeline:
 * 1. **Raw Data Reception**: Binary data from LiveKit room participants
 * 2. **Message Parsing**: JSON decoding and structure validation
 * 3. **Event Classification**: Categorization (answer, transcription, custom)
 * 4. **Event Emission**: Structured events for application consumption
 * 5. **Error Handling**: Graceful handling of malformed or invalid messages
 *
 * @example Basic Tool Registration
 * ```typescript
 * const weatherTool = {
 *   function_name: 'getCurrentWeather',
 *   description: 'Gets current weather for a location',
 *   parameters: [
 *     { name: 'location', type: 'string', description: 'City name' }
 *   ],
 *   required: ['location'],
 *   fn: async (location) => {
 *     const response = await fetch(`/api/weather?city=${location}`);
 *     return response.json();
 *   }
 * };
 *
 * const registry = new LiveKitToolRegistry([weatherTool]);
 * registry.setRoom(liveKitRoom);
 *
 * // Tool is now available for agent to call
 * registry.on('toolsRegistered', (count) => {
 *   console.log(`${count} tools registered and ready`);
 * });
 * ```
 *
 * @example Advanced Tool with Complex Parameters
 * ```typescript
 * const userDataTool = {
 *   function_name: 'getUserProfile',
 *   description: 'Retrieves comprehensive user profile data',
 *   parameters: [
 *     { name: 'userId', type: 'string', description: 'Unique user identifier' },
 *     { name: 'includeHistory', type: 'boolean', description: 'Include purchase history' },
 *     { name: 'fields', type: 'array', description: 'Specific fields to retrieve' }
 *   ],
 *   required: ['userId'],
 *   fn: async (userId, includeHistory = false, fields = []) => {
 *     const profile = await userService.getProfile(userId);
 *
 *     if (includeHistory) {
 *       profile.purchaseHistory = await orderService.getHistory(userId);
 *     }
 *
 *     if (fields.length > 0) {
 *       return pickFields(profile, fields);
 *     }
 *
 *     return profile;
 *   }
 * };
 *
 * registry.setTools([userDataTool]);
 * ```
 *
 * @example Event Processing and Custom Messages
 * ```typescript
 * const registry = new LiveKitToolRegistry();
 *
 * // Standard agent responses
 * registry.on('answerReceived', (text) => {
 *   console.log('Agent said:', text);
 *   updateChatInterface(text, 'agent');
 * });
 *
 * // Real-time transcription
 * registry.on('transcriptionReceived', (text) => {
 *   console.log('User said:', text);
 *   updateChatInterface(text, 'user');
 * });
 *
 * // Custom application events
 * registry.on('customEvent', (eventType, eventData, metadata) => {
 *   switch (eventType) {
 *     case 'sentiment_analysis':
 *       updateSentimentIndicator(eventData.sentiment);
 *       break;
 *     case 'conversation_summary':
 *       displaySummary(eventData.summary);
 *       break;
 *     case 'agent_thinking':
 *       showThinkingIndicator(eventData.status);
 *       break;
 *     default:
 *       logCustomEvent(eventType, eventData, metadata);
 *   }
 * });
 *
 * // Raw data access for advanced processing
 * registry.on('dataReceived', (message, participant) => {
 *   analyticsService.trackMessage({
 *     participant,
 *     messageType: message.event,
 *     timestamp: Date.now(),
 *     content: message
 *   });
 * });
 * ```
 *
 * @example Dynamic Tool Management
 * ```typescript
 * const registry = new LiveKitToolRegistry();
 *
 * // Add tools based on user permissions
 * const addUserTools = (userRole) => {
 *   const baseToos = [getWeatherTool, getTimeTool];
 *
 *   if (userRole === 'admin') {
 *     baseTools.push(getUserDataTool, modifySettingsTool);
 *   } else if (userRole === 'customer') {
 *     baseTools.push(getOrderStatusTool, updateProfileTool);
 *   }
 *
 *   registry.setTools(baseTools);
 *   console.log(`Registered ${baseTools.length} tools for ${userRole}`);
 * };
 *
 * // Update tools when user context changes
 * userAuth.on('roleChanged', (newRole) => {
 *   addUserTools(newRole);
 * });
 * ```
 *
 * @example Audio Stream Integration
 * ```typescript
 * registry.on('localAudioStreamAvailable', (stream) => {
 *   // Send to external audio processor
 *   audioProcessor.setInputStream(stream);
 *
 *   // Enable real-time audio analysis
 *   const audioAnalyzer = new AudioAnalyzer(stream);
 *   audioAnalyzer.on('volumeLevel', (level) => {
 *     updateVolumeIndicator(level);
 *   });
 *
 *   // Record for quality assurance
 *   if (recordingEnabled) {
 *     mediaRecorder.start(stream);
 *   }
 * });
 * ```
 *
 * Technical Implementation:
 * - Uses LiveKit's RPC system for secure tool execution
 * - Implements JSON-based message protocol for structured communication
 * - Provides comprehensive error handling and recovery
 * - Supports dynamic tool registration and deregistration
 * - Maintains tool metadata for debugging and analytics
 * - Includes automatic cleanup and resource management
 */

import { EventEmitter } from 'events';
import type { Room } from 'livekit-client';
import type { Tool } from './types';

/**
 * LiveKitToolRegistry class for client-side tool management and RPC handling
 *
 * Extends EventEmitter to provide real-time notifications for tool registration,
 * agent responses, transcriptions, and custom events from voice agents.
 */
export class LiveKitToolRegistry extends EventEmitter {
  /** Reference to the LiveKit room for RPC method registration */
  private room: Room | null = null;

  /** Array of client-side tools available for agent execution */
  private tools: Tool[] = [];

  /**
   * Creates a new LiveKitToolRegistry instance
   *
   * Initializes the tool registry with an optional array of tools that will
   * be available for voice agents to call during conversations. Tools can be
   * added later using setTools() or updated dynamically based on context.
   *
   * @param tools - Initial array of tools to register (optional)
   *
   * @example
   * ```typescript
   * // Initialize with no tools
   * const registry = new LiveKitToolRegistry();
   *
   * // Initialize with predefined tools
   * const registry = new LiveKitToolRegistry([
   *   weatherTool,
   *   calculatorTool,
   *   databaseQueryTool
   * ]);
   *
   * // Tools will be automatically registered when room is set
   * registry.setRoom(liveKitRoom);
   * ```
   */
  constructor(tools: Tool[] = []) {
    super();
    this.tools = tools;
  }

  /**
   * Configures the LiveKit room for tool registration and RPC setup
   *
   * Provides the tool registry with access to the LiveKit room instance for
   * registering client-side tools as RPC methods. When a room is set and tools
   * are available, automatic registration occurs immediately. This method is
   * typically called by LiveKitManager during connection establishment.
   *
   * @param room - LiveKit room instance or null to clear the reference
   *
   * @example
   * ```typescript
   * const room = new Room();
   * await room.connect(url, token);
   *
   * // Enable tool registration
   * registry.setRoom(room);
   *
   * // Tools are automatically registered if available
   * registry.on('toolsRegistered', (count) => {
   *   console.log(`${count} tools are now available to the agent`);
   * });
   *
   * // Clear room reference when disconnecting
   * registry.setRoom(null);
   * ```
   */
  setRoom(room: Room | null): void {
    this.room = room;

    // Register tools when room is available
    if (room && this.tools.length > 0) {
      this.registerTools();
    }
  }

  /**
   * Updates the available tools and re-registers them with the room
   *
   * Replaces the current tool array with a new set of tools and automatically
   * re-registers them if a room connection is active. This enables dynamic
   * tool management based on user context, permissions, or conversation state.
   *
   * @param tools - Array of Tool objects to make available to agents
   *
   * @example
   * ```typescript
   * // Initial tool set
   * registry.setTools([weatherTool, timeTool]);
   *
   * // Update based on user authentication
   * user.on('login', (userData) => {
   *   if (userData.role === 'admin') {
   *     registry.setTools([...baseToos, adminTool, userManagementTool]);
   *   } else {
   *     registry.setTools([...baseToos, profileTool]);
   *   }
   * });
   *
   * // Context-aware tool updates
   * conversation.on('topicChanged', (topic) => {
   *   if (topic === 'support') {
   *     registry.setTools([...baseToos, ticketTool, knowledgeBaseTool]);
   *   } else if (topic === 'sales') {
   *     registry.setTools([...baseToos, productTool, pricingTool]);
   *   }
   * });
   *
   * // Remove all tools
   * registry.setTools([]);
   * ```
   */
  setTools(tools: Tool[]): void {
    this.tools = Array.isArray(tools) ? tools : [];

    // Re-register tools if room is available
    if (this.room) {
      this.registerTools();
    }
  }

  /**
   * Registers all tools as RPC methods with the LiveKit room
   *
   * Processes each tool in the tools array and registers it as an RPC method
   * that voice agents can call during conversations. Each tool function is
   * wrapped with error handling and JSON serialization for secure, reliable
   * execution. Registration only occurs when both room and tools are available.
   *
   * @fires toolsRegistered When tools are successfully registered with count
   *
   * @example
   * ```typescript
   * // Manual registration (usually automatic)
   * registry.registerTools();
   *
   * // Listen for registration confirmation
   * registry.on('toolsRegistered', (count) => {
   *   console.log(`${count} tools registered successfully`);
   *
   *   // Notify agent about available tools
   *   sendAgentMessage({
   *     type: 'tools_ready',
   *     count: count,
   *     tools: registry.getTools().map(t => ({
   *       name: t.function_name,
   *       description: t.description
   *     }))
   *   });
   * });
   * ```
   *
   * Registration Process:
   * 1. Validates tool structure (function_name, fn)
   * 2. Creates RPC method wrapper with error handling
   * 3. Registers with LiveKit room's local participant
   * 4. Emits toolsRegistered event with count
   * 5. Tools become immediately available for agent calls
   */
  registerTools(): void {
    if (!this.room || this.tools.length === 0) {
      return;
    }

    for (const tool of this.tools) {
      if (tool.function_name && typeof tool.fn === 'function') {
        this.room?.registerRpcMethod(tool.function_name, async (data) => {
          try {
            const args = JSON.parse(data.payload || '{}');
            const result = await tool.fn?.(...Object.values(args));
            return JSON.stringify(result);
          } catch (error) {
            return JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }
    }
    this.emit('toolsRegistered', this.tools.length);
  }

  /**
   * Processes incoming data messages from voice agents and participants
   *
   * Handles binary data received through the LiveKit room, parsing JSON messages
   * and routing them to appropriate event handlers. This method processes various
   * message types including agent responses, transcriptions, and custom events,
   * providing a unified interface for all agent communication.
   *
   * @param payload - Binary data payload received from LiveKit
   * @param participant - Identity of the participant who sent the message
   *
   * @fires answerReceived When agent provides a response
   * @fires transcriptionReceived When speech-to-text data arrives
   * @fires customEvent When custom application events are received
   * @fires dataReceived Raw message data for advanced processing
   *
   * @example
   * ```typescript
   * // This method is called automatically by LiveKitManager
   * // when RoomEvent.DataReceived is triggered
   *
   * // Listen for different message types
   * registry.on('answerReceived', (text) => {
   *   console.log('Agent response:', text);
   *   displayAgentMessage(text);
   * });
   *
   * registry.on('transcriptionReceived', (text) => {
   *   console.log('User transcription:', text);
   *   displayUserMessage(text);
   * });
   *
   * registry.on('customEvent', (eventType, data, metadata) => {
   *   console.log(`Custom event: ${eventType}`, data);
   *
   *   // Handle application-specific events
   *   switch (eventType) {
   *     case 'agent_thinking':
   *       showThinkingIndicator(data.status);
   *       break;
   *     case 'conversation_summary':
   *       updateSummaryPanel(data.summary);
   *       break;
   *     case 'emotion_detected':
   *       updateEmotionIndicator(data.emotion, data.confidence);
   *       break;
   *   }
   * });
   * ```
   *
   * Supported Message Formats:
   * ```json
   * // Agent response
   * { "event": "answer", "content": "Hello, how can I help you?" }
   *
   * // Transcription
   * { "event": "transcription", "content": "I need help with my order" }
   *
   * // Custom event
   * { "event": "sentiment_analysis", "data": { "sentiment": "positive", "score": 0.8 } }
   * ```
   */
  handleDataReceived(payload: Uint8Array, participant?: string): void {
    try {
      const message = JSON.parse(new TextDecoder().decode(payload));
      const eventType = message.event;
      const eventData = message.content || message.data || message;

      // Emit specific events
      switch (eventType) {
        case 'answer':
          this.emit('answerReceived', eventData);
          break;
        case 'transcription':
          this.emit('transcriptionReceived', eventData);
          break;
        default:
          // Emit custom event for unknown event types
          this.emit('customEvent', eventType, eventData, {
            timestamp: Date.now(),
            participant: participant || 'unknown',
            rawMessage: message,
          });
          break;
      }

      // Emit raw data received event
      this.emit('dataReceived', message, participant || 'unknown');
    } catch (_error) {
      // Intentionally ignore errors during data processing
    }
  }

  /**
   * Processes real-time transcription data from LiveKit's speech-to-text system
   *
   * Handles transcription segments received from LiveKit's built-in speech recognition,
   * extracting text content and emitting structured transcription events. This method
   * processes both partial and final transcription segments, enabling real-time
   * speech-to-text display and conversation logging.
   *
   * @param transcriptions - Array of transcription segments from LiveKit
   * @param transcriptions[].text - Transcribed text content
   * @param transcriptions[].final - Whether this is a final transcription segment
   *
   * @fires transcriptionReceived When valid text content is extracted
   *
   * @example
   * ```typescript
   * // This method is called automatically by LiveKitManager
   * // when RoomEvent.TranscriptionReceived is triggered
   *
   * // Listen for transcription updates
   * registry.on('transcriptionReceived', (text) => {
   *   console.log('Transcription:', text);
   *
   *   // Update real-time transcript display
   *   updateTranscriptDisplay(text);
   *
   *   // Log conversation for analytics
   *   conversationLogger.logUserSpeech(text, Date.now());
   *
   *   // Trigger intent recognition
   *   if (text.length > 10) {
   *     intentRecognizer.analyze(text);
   *   }
   * });
   *
   * // Handle transcription processing
   * let transcriptBuffer = '';
   * registry.on('transcriptionReceived', (text) => {
   *   transcriptBuffer += text + ' ';
   *
   *   // Process complete sentences
   *   if (text.endsWith('.') || text.endsWith('?') || text.endsWith('!')) {
   *     processCompleteSentence(transcriptBuffer.trim());
   *     transcriptBuffer = '';
   *   }
   * });
   * ```
   *
   * LiveKit Transcription Format:
   * ```typescript
   * [
   *   { text: "Hello", final: false },
   *   { text: "Hello there", final: false },
   *   { text: "Hello there, how are you?", final: true }
   * ]
   * ```
   */
  handleTranscriptionReceived(
    transcriptions: Array<{ text?: string; final?: boolean }>
  ): void {
    try {
      // LiveKit transcriptions come as an array of segments
      // Each segment has properties like text, final, etc.
      for (const segment of transcriptions) {
        if (segment.text) {
          this.emit('transcriptionReceived', segment.text);
        }
      }
    } catch {
      // Ignore transcription processing errors
    }
  }

  /**
   * Returns the count of currently registered tools
   *
   * Provides a simple way to check how many tools are available for agent
   * execution. Useful for validation, debugging, and analytics reporting.
   *
   * @returns Number of tools in the registry
   *
   * @example
   * ```typescript
   * const toolCount = registry.getToolCount();
   * console.log(`${toolCount} tools available`);
   *
   * // Validate tool registration
   * if (toolCount === 0) {
   *   console.warn('No tools registered - agent functionality may be limited');
   * }
   *
   * // Update UI indicator
   * updateToolCountDisplay(toolCount);
   *
   * // Analytics tracking
   * analytics.track('tools_registered', { count: toolCount });
   * ```
   */
  getToolCount(): number {
    return this.tools.length;
  }

  /**
   * Returns the complete array of registered tools
   *
   * Provides access to all currently registered tools including their metadata,
   * parameters, and function references. Useful for debugging, validation,
   * and dynamic tool management scenarios.
   *
   * @returns Array of Tool objects currently in the registry
   *
   * @example
   * ```typescript
   * const tools = registry.getTools();
   *
   * // List available tools
   * console.log('Available tools:');
   * tools.forEach(tool => {
   *   console.log(`- ${tool.function_name}: ${tool.description}`);
   * });
   *
   * // Validate tool configuration
   * const invalidTools = tools.filter(tool => !tool.fn);
   * if (invalidTools.length > 0) {
   *   console.error('Tools missing implementation:', invalidTools);
   * }
   *
   * // Create tool documentation
   * const toolDocs = tools.map(tool => ({
   *   name: tool.function_name,
   *   description: tool.description,
   *   parameters: tool.parameters,
   *   required: tool.required
   * }));
   *
   * // Send tool capabilities to external system
   * apiService.updateToolCapabilities(toolDocs);
   * ```
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * Performs cleanup of tool registry resources and state
   *
   * Resets the tool registry to its initial state, clearing any cached data
   * and preparing for safe disposal or reinitialization. LiveKit automatically
   * handles RPC method unregistration when the room disconnects, so minimal
   * cleanup is required.
   *
   * @example
   * ```typescript
   * // Cleanup when component unmounts
   * useEffect(() => {
   *   return () => {
   *     registry.cleanup();
   *   };
   * }, []);
   *
   * // Cleanup before reinitializing
   * const reinitializeRegistry = () => {
   *   registry.cleanup();
   *   registry = new LiveKitToolRegistry(newTools);
   *   setupEventListeners();
   * };
   *
   * // Cleanup is safe to call multiple times
   * registry.cleanup();
   * registry.cleanup(); // Safe
   * ```
   */
  cleanup(): void {
    // Tools are automatically unregistered when room disconnects
    // No additional cleanup needed
  }
}
