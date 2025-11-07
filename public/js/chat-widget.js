(function() {
    'use strict';

    // Default configuration
    const defaultConfig = {
        baseUrl: window.chatWidgetConfig?.baseUrl || window.location.origin,
        pusherKey: window.chatWidgetConfig?.pusherKey || 'f603781148035e119bff',
        position: window.chatWidgetConfig?.position || 'bottom-right',
        primaryColor: window.chatWidgetConfig?.primaryColor || '#667eea',
        secondaryColor: window.chatWidgetConfig?.secondaryColor || '#764ba2',
        widgetTitle: window.chatWidgetConfig?.widgetTitle || 'Live Chat Support',
        welcomeMessage: window.chatWidgetConfig?.welcomeMessage || 'Hello! How can we help you today?'
    };

    class FloatingChatWidget {
        constructor(config) {
            this.config = { ...defaultConfig, ...config };
            this.isOpen = false;
            this.sessionId = null;
            this.pusher = null;
            this.channel = null;
            this.unreadMessages = 0;
            
            this.init();
        }

        async init() {
            try {
                this.createWidgetHTML();
                this.initializeSession();
                this.setupEventListeners();
                this.initializePusher();
                
                console.log('Chat widget initialized successfully');
            } catch (error) {
                console.error('Failed to initialize chat widget:', error);
            }
        }

        createWidgetHTML() {
            // Remove existing widget if any
            const existingWidget = document.getElementById('floating-chat-widget');
            if (existingWidget) {
                existingWidget.remove();
            }

            const widgetHTML = `
                <div id="floating-chat-widget" class="chat-widget-container chat-widget-${this.config.position}">
                    <button class="chat-toggle-btn" id="chatToggle">
                        💬
                        <span class="chat-notification-badge" id="notificationBadge" style="display: none;">0</span>
                    </button>
                    
                    <div class="chat-container" id="chatContainer">
                        <div class="chat-header">
                            <div class="chat-title">${this.config.widgetTitle}</div>
                            <div class="chat-status">Online</div>
                            <button class="chat-close" id="chatClose">×</button>
                        </div>
                        
                        <div class="chat-messages" id="chatMessages">
                            <div class="welcome-state">
                                <div class="welcome-icon">💬</div>
                                <div class="welcome-text">
                                    <strong>Welcome!</strong><br>
                                    ${this.config.welcomeMessage}
                                </div>
                            </div>
                        </div>
                        
                        <div class="chat-input-area">
                            <textarea 
                                class="chat-input" 
                                id="chatInput" 
                                placeholder="Type your message..." 
                                rows="1"
                            ></textarea>
                            <button class="send-button" id="sendButton">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', widgetHTML);
            
            // Apply custom colors
            this.applyCustomColors();
        }

        applyCustomColors() {
            const style = document.createElement('style');
            style.textContent = `
                .chat-toggle-btn {
                    background: linear-gradient(135deg, ${this.config.primaryColor} 0%, ${this.config.secondaryColor} 100%) !important;
                }
                .chat-header {
                    background: linear-gradient(135deg, ${this.config.primaryColor} 0%, ${this.config.secondaryColor} 100%) !important;
                }
                .user-message .message-bubble {
                    background: ${this.config.primaryColor} !important;
                }
                .send-button {
                    background: ${this.config.primaryColor} !important;
                }
                .send-button:hover {
                    background: ${this.config.secondaryColor} !important;
                }
            `;
            document.head.appendChild(style);
        }

        setupEventListeners() {
            // Toggle chat window
            document.getElementById('chatToggle').addEventListener('click', () => {
                this.toggleChat();
            });

            // Close chat window
            document.getElementById('chatClose').addEventListener('click', () => {
                this.closeChat();
            });

            // Send message on button click
            document.getElementById('sendButton').addEventListener('click', () => {
                this.sendMessage();
            });

            // Send message on Enter key (but allow Shift+Enter for new line)
            document.getElementById('chatInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            document.getElementById('chatInput').addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            });

            // Close chat when clicking outside
            document.addEventListener('click', (e) => {
                if (this.isOpen && !e.target.closest('#floating-chat-widget')) {
                    this.closeChat();
                }
            });

            // Handle Escape key to close chat
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeChat();
                }
            });
        }

        toggleChat() {
            this.isOpen = !this.isOpen;
            const container = document.getElementById('chatContainer');
            const toggle = document.getElementById('chatToggle');
            const badge = document.getElementById('notificationBadge');

            if (this.isOpen) {
                // Open chat
                container.classList.add('open');
                toggle.style.transform = 'scale(0.9)';
                
                // Focus input after animation
                setTimeout(() => {
                    document.getElementById('chatInput').focus();
                }, 300);

                // Reset unread messages
                this.unreadMessages = 0;
                badge.style.display = 'none';
                
                // Mark as read
                this.markAsRead();
            } else {
                // Close chat
                container.classList.remove('open');
                toggle.style.transform = 'scale(1)';
            }
        }

        openChat() {
            if (!this.isOpen) {
                this.toggleChat();
            }
        }

        closeChat() {
            if (this.isOpen) {
                this.toggleChat();
            }
        }

        async initializeSession() {
            try {
                // Check for existing session in localStorage
                this.sessionId = localStorage.getItem('chat_session_id');
                
                if (!this.sessionId) {
                    const response = await fetch(`${this.config.baseUrl}/api/chat/init`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to initialize session');
                    }
                    
                    const data = await response.json();
                    this.sessionId = data.session_id;
                    localStorage.setItem('chat_session_id', this.sessionId);
                }

                // Load previous messages
                await this.loadMessages();
                
            } catch (error) {
                console.error('Session initialization failed:', error);
                this.showError('Failed to connect to chat service');
            }
        }

        initializePusher() {
            try {
                this.pusher = new Pusher(this.config.pusherKey, {
                    cluster: 'mt1',
                    forceTLS: true
                });

                // Subscribe when session is available
                if (this.sessionId) {
                    this.subscribeToChannel();
                }
            } catch (error) {
                console.error('Pusher initialization failed:', error);
            }
        }

        subscribeToChannel() {
            if (!this.sessionId || !this.pusher) return;

            try {
                // Unsubscribe from previous channel if exists
                if (this.channel) {
                    this.pusher.unsubscribe(this.channel.name);
                }

                this.channel = this.pusher.subscribe('chat.' + this.sessionId);
                
                this.channel.bind('new-message', (data) => {
                    this.handleNewMessage(data);
                });

                console.log('Subscribed to channel: chat.' + this.sessionId);
            } catch (error) {
                console.error('Failed to subscribe to channel:', error);
            }
        }

        handleNewMessage(data) {
            // Display the message
            this.displayMessage(data.message, data.senderType, data.timestamp);
            this.hideWelcomeState();

            // If chat is closed, show notification
            if (!this.isOpen && data.senderType === 'agent') {
                this.unreadMessages++;
                this.showNotification();
            }

            // Play notification sound for agent messages
            if (data.senderType === 'agent') {
                this.playNotificationSound();
            }
        }

        showNotification() {
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.textContent = this.unreadMessages;
                badge.style.display = 'flex';
                
                // Add pulse animation
                badge.style.animation = 'none';
                setTimeout(() => {
                    badge.style.animation = 'pulse 2s infinite';
                }, 10);
            }
        }

        playNotificationSound() {
            // Create a simple notification sound
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (error) {
                // Silent fail if audio is not supported
            }
        }

        markAsRead() {
            this.unreadMessages = 0;
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.style.display = 'none';
            }
        }

        async sendMessage() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();

            if (!message || !this.sessionId) {
                return;
            }

            try {
                // Display user message immediately
                this.displayMessage(message, 'user', new Date().toISOString());
                this.hideWelcomeState();

                // Clear input
                input.value = '';
                input.style.height = 'auto';

                // Send to server
                const response = await fetch(`${this.config.baseUrl}/api/chat/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        message: message,
                        session_id: this.sessionId
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

            } catch (error) {
                console.error('Failed to send message:', error);
                this.showError('Failed to send message. Please try again.');
            }
        }

        displayMessage(message, senderType, timestamp) {
            const messagesContainer = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            
            messageDiv.className = `message ${senderType}-message`;
            
            const time = new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.innerHTML = `
                <div class="message-bubble">${this.escapeHtml(message)}</div>
                <div class="message-time">${time}</div>
            `;

            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        async loadMessages() {
            if (!this.sessionId) return;

            try {
                const response = await fetch(`${this.config.baseUrl}/api/chat/messages`, {
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to load messages');
                }

                const messages = await response.json();
                
                if (messages.length > 0) {
                    this.hideWelcomeState();
                    messages.forEach(message => {
                        this.displayMessage(
                            message.message, 
                            message.sender_type, 
                            message.created_at
                        );
                    });
                }
            } catch (error) {
                console.error('Failed to load messages:', error);
            }
        }

        hideWelcomeState() {
            const welcomeState = document.querySelector('.welcome-state');
            if (welcomeState) {
                welcomeState.style.display = 'none';
            }
        }

        showError(message) {
            const messagesContainer = document.getElementById('chatMessages');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'chat-error';
            errorDiv.innerHTML = `
                ${message}
                <button class="chat-retry-button" onclick="window.chatWidget.initializeSession()">Retry</button>
            `;
            messagesContainer.appendChild(errorDiv);
        }

        getCsrfToken() {
            // Try to get CSRF token from meta tag
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                return metaTag.content;
            }
            
            // Try to get from Laravel's default cookie name
            return this.getCookie('XSRF-TOKEN') || '';
        }

        getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        }

        escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Public methods
        open() {
            this.openChat();
        }

        close() {
            this.closeChat();
        }

        destroy() {
            if (this.pusher && this.channel) {
                this.pusher.unsubscribe(this.channel.name);
            }
            const widget = document.getElementById('floating-chat-widget');
            if (widget) {
                widget.remove();
            }
        }
    }

    // Initialize when DOM is ready
    function initChatWidget() {
        if (window.Pusher) {
            window.chatWidget = new FloatingChatWidget();
        } else {
            // Load Pusher first
            const script = document.createElement('script');
            script.src = 'https://js.pusher.com/7.0/pusher.min.js';
            script.onload = () => {
                window.chatWidget = new FloatingChatWidget();
            };
            script.onerror = () => {
                console.error('Failed to load Pusher library');
            };
            document.head.appendChild(script);
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatWidget);
    } else {
        initChatWidget();
    }

    // Global access
    window.FloatingChatWidget = FloatingChatWidget;
})();