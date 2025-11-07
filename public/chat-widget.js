class ChatWidget {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.isOpen = false;
        this.isMinimized = false;
        this.pusher = null;
        this.channel = null;
        this.baseUrl = 'http://0.0.0.0';
        this.customerName = this.getStoredCustomerName();
        this.customerEmail = this.getStoredCustomerEmail();
        this.isNewSession = false;
        this.audio = new Audio('https://www.dotflo.org/live-chat.mp3');

        console.log('ChatWidget initialized with session:', this.sessionId);
        console.log('Customer info:', { name: this.customerName, email: this.customerEmail });

        this.init();
    }

    getOrCreateSessionId() {

        let sessionId = localStorage.getItem('chat_session_id');
        const sessionCreated = localStorage.getItem('chat_session_created');

        console.log('Retrieved sessionId from localStorage:', sessionId);

        const maxSessionAge = 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (sessionId && sessionCreated) {
            const sessionAge = now - parseInt(sessionCreated);
            if (sessionAge > maxSessionAge) {

                sessionId = null;
                this.clearSessionData();
                console.log('Session expired, creating new one');
            }
        }

        if (!sessionId) {
            sessionId = 'chat_' + Math.random().toString(36).substr(2, 9) + '_' + now;
            localStorage.setItem('chat_session_id', sessionId);
            localStorage.setItem('chat_session_created', now.toString());
            this.isNewSession = true;
            console.log('Created new session:', sessionId);
        } else {
            console.log('Using existing session:', sessionId);
        }

        return sessionId;
    }

    getStoredCustomerName() {
        return localStorage.getItem('chat_customer_name') || '';
    }

    getStoredCustomerEmail() {
        return localStorage.getItem('chat_customer_email') || '';
    }

    setStoredCustomerInfo(name, email) {
        localStorage.setItem('chat_customer_name', name);
        localStorage.setItem('chat_customer_email', email);
        console.log('Saved customer info to localStorage:', { name, email });
    }

    clearSessionData() {
        localStorage.removeItem('chat_session_id');
        localStorage.removeItem('chat_session_created');
        localStorage.removeItem('chat_customer_name');
        localStorage.removeItem('chat_customer_email');
        console.log('Cleared all session data from localStorage');
    }

    endSession() {
        if (confirm('Are you sure you want to end this chat session? This will clear all chat history and start a new session.')) {
            this.clearSessionData();

            if (this.pusher) {
                this.pusher.disconnect();
            }

            if (this.widget) {
                this.widget.remove();
            }

            setTimeout(() => {
                new ChatWidget();
            }, 500);
        }
    }

    playNotificationSound() {
        try {
            this.audio.currentTime = 0;
            this.audio.play().catch(e => {
                console.log('Audio play failed:', e);
            });
        } catch (error) {
            console.log('Error playing sound:', error);
        }
    }

    init() {
        this.createWidget();
        this.initPusher();
        this.loadMessages();
        this.checkUnreadMessages();

        setInterval(() => this.updateSessionActivity(), 30000);

        window.addEventListener('beforeunload', () => this.updateSessionActivity());

        this.testStoragePersistence();
    }

    testStoragePersistence() {
        console.log('=== STORAGE PERSISTENCE TEST ===');
        console.log('Session ID from localStorage:', localStorage.getItem('chat_session_id'));
        console.log('Customer name from localStorage:', localStorage.getItem('chat_customer_name'));
        console.log('Customer email from localStorage:', localStorage.getItem('chat_customer_email'));
        console.log('=== END TEST ===');
    }


    async testPusherConnection() {
        try {
            console.log('Testing Pusher connection...');
            const response = await fetch(`${this.baseUrl}/api/chat/debug/pusher`);
            const data = await response.json();
            console.log('Pusher test result:', data);
            return data;
        } catch (error) {
            console.error('Pusher test failed:', error);
            return { status: 'error', message: error.message };
        }
    }

    async testEventBroadcasting() {
        try {
            console.log('Testing event broadcasting for session:', this.sessionId);
            const response = await fetch(`${this.baseUrl}/api/chat/debug/event/${this.sessionId}`);
            const data = await response.json();
            console.log('Event test result:', data);
            return data;
        } catch (error) {
            console.error('Event test failed:', error);
            return { status: 'error', message: error.message };
        }
    }

    subscribeToChannel() {
        if (!this.pusher) {
            console.error('Pusher not initialized');
            return;
        }

        try {
            const channelName = `chat.${this.sessionId}`;
            console.log('Subscribing to channel:', channelName);

            this.channel = this.pusher.subscribe(`chat.${this.sessionId}`);

            this.channel.bind('pusher:subscription_succeeded', () => {
                console.log('Successfully subscribed to channel:', channelName);

                setTimeout(() => {
                    this.testEventBroadcasting();
                }, 500);
            });

            this.channel.bind('pusher:subscription_error', (err) => {
                console.error('Subscription error:', err);
            });

            this.channel.bind('new.message', (data) => {
                console.log('Received real-time message:', data);

                this.displayMessage(data, true);

                if (data.sender_type === 'admin') {
                    this.showNotification();
                }

                this.scrollToBottom();
            });

            //listen 
            this.channel.bind('test.event', (data) => {
                console.log('Test event received:', data);
            });

        } catch (error) {
            console.error('Error subscribing to channel:', error);
        }
    }

    displayMessage(message, isRealtime = false) {
        const messagesContainer = document.getElementById('messagesContainer');

        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }

        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) {
            console.log('Message already exists, skipping display:', message.id);
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_type}`;
        messageElement.setAttribute('data-message-id', message.id);

        const time = new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">${this.escapeHtml(message.message)}</div>
                <div class="message-time">${time} ${isRealtime ? '' : ''}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        console.log(`Displayed message (realtime: ${isRealtime}):`, message);

        if (isRealtime && message.sender_type === 'admin') {
            this.playNotificationSound();
        }
    }

    async updateSessionActivity() {
        try {
            await fetch(`${this.baseUrl}/api/chat/session/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    customer_name: this.customerName,
                    customer_email: this.customerEmail
                })
            });
            console.log('Session heartbeat sent for:', this.sessionId);
        } catch (error) {
            console.log('Session heartbeat failed:', error);
        }
    }

    createWidget() {
        this.widget = document.createElement('div');
        this.widget.id = 'chat-widget';
        this.widget.innerHTML = `
            <div class="chat-container ${this.isMinimized ? 'minimized' : ''}">
                <div class="chat-header">
                    <div class="chat-title">
                        <span class="status-indicator"></span>
                        Live Chat Support
                    </div>
                    <div class="chat-actions">
                        <button class="btn-end-session" title="End Session">END</button>
                        <button class="btn-minimize">-</button>
                        <button class="btn-close">+</button>
                    </div>
                </div>
                
                <div class="chat-body">
                    <div class="messages-container" id="messagesContainer">
                        <div class="loading-message">Loading messages...</div>
                    </div>
                    
                    <div class="chat-input-area">
                        <div class="customer-info" id="customerInfo" style="display: none;">
                            <input type="text" id="customerName" placeholder="Your Name" class="info-input" value="${this.escapeHtml(this.customerName)}">
                            <input type="email" id="customerEmail" placeholder="Your Email" class="info-input" value="${this.escapeHtml(this.customerEmail)}">
                            <button id="btnSaveInfo" class="btn-save-info">Start Chat</button>
                        </div>
                        
                        <div class="message-input-group" id="messageInputGroup" style="display: none;">
                            <input type="text" id="messageInput" placeholder="Type your message..." maxlength="1000">
                            <button id="btnSend" class="btn-send">Send</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="chat-toggle-btn" id="chatToggleBtn">
                <span class="notification-badge" id="notificationBadge" style="display: none;"></span>
                Start
            </button>
        `;

        document.body.appendChild(this.widget);
        this.bindEvents();
        this.applyStyles();

        if (this.customerName && this.customerEmail) {
            console.log('Auto-showing message input for returning customer');
            this.showMessageInput();
        }
    }

    applyStyles() {
        const styles = `
            <style>
            #chat-widget {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
            }
            
            .chat-toggle-btn {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #007bff;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .chat-toggle-btn:hover {
                background: #0056b3;
                transform: scale(1.05);
            }
            
            .notification-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #dc3545;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .chat-container {
                position: absolute;
                bottom: 70px;
                right: 0;
                width: 350px;
                height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                display: flex;
                flex-direction: column;
                transition: all 0.3s ease;
                overflow: hidden;
            }
            
            .chat-container.minimized {
                height: 45px;
            }
            
            .chat-header {
                background: #007bff;
                color: white;
                padding: 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
            }
            
            .chat-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #28a745;
                animation: pulse 2s infinite;
            }
            
            .chat-actions {
                display: flex;
                gap: 5px;
            }
            
            .chat-actions button {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0 5px;
                transition: opacity 0.2s ease;
            }
            
            .chat-actions button:hover {
                opacity: 0.8;
            }
            
            .btn-end-session {
                font-size: 16px !important;
                opacity: 0.8;
            }
            
            .btn-end-session:hover {
                opacity: 1;
                transform: rotate(180deg);
                transition: transform 0.3s ease;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            .chat-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .messages-container {
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                background: #f8f9fa;
            }
            
            .message {
                margin-bottom: 12px;
                display: flex;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .message.customer {
                justify-content: flex-end;
            }
            
            .message.admin {
                justify-content: flex-start;
            }
            
            .message-bubble {
                max-width: 80%;
                padding: 10px 14px;
                border-radius: 18px;
                word-wrap: break-word;
            }
            
            .message.customer .message-bubble {
                background: #007bff;
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .message.admin .message-bubble {
                background: white;
                color: #333;
                border: 1px solid #e0e0e0;
                border-bottom-left-radius: 4px;
            }
            
            .message-time {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                text-align: right;
            }
            
            .message.admin .message-time {
                text-align: left;
            }
            
            .chat-input-area {
                padding: 15px;
                border-top: 1px solid #e0e0e0;
                background: white;
            }
            
            .customer-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .info-input {
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .btn-save-info, .btn-send {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .btn-save-info:hover, .btn-send:hover {
                background: #0056b3;
            }
            
            .message-input-group {
                display: flex;
                gap: 8px;
            }
            
            #messageInput {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .loading-message {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }
            
            .welcome-message {
                text-align: center;
                color: #666;
                padding: 20px;
                font-size: 14px;
            }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    bindEvents() {

        document.getElementById('chatToggleBtn').addEventListener('click', () => this.toggleChat());
        document.querySelector('.btn-minimize').addEventListener('click', () => this.minimizeChat());
        document.querySelector('.btn-close').addEventListener('click', () => this.closeChat());
        document.querySelector('.btn-end-session').addEventListener('click', () => this.endSession());

        document.querySelector('.chat-header').addEventListener('click', (e) => {
            if (e.target.classList.contains('chat-header')) {
                this.minimizeChat();
            }
        });

        document.getElementById('btnSend').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.getElementById('btnSaveInfo').addEventListener('click', () => this.saveCustomerInfo());

        document.getElementById('customerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('customerEmail').focus();
        });
        document.getElementById('customerEmail').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveCustomerInfo();
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.widget.querySelector('.chat-container').classList.remove('minimized');
            this.isMinimized = false;
            this.hideNotification();
            this.loadMessages();
        } else {
            this.minimizeChat();
        }
    }

    minimizeChat() {
        this.isMinimized = !this.isMinimized;
        this.widget.querySelector('.chat-container').classList.toggle('minimized', this.isMinimized);
    }

    closeChat() {
        this.isOpen = false;
        this.minimizeChat();
    }

    async loadMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        console.log('Loading messages for session:', this.sessionId);

        try {
            const response = await fetch(`${this.baseUrl}/api/chat/messages?session_id=${this.sessionId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Loaded messages:', data.messages);

            messagesContainer.innerHTML = '';

            if (this.customerName && this.customerEmail && data.messages.length === 0) {
                this.showMessageInput();
                this.addWelcomeMessage();
                console.log('Showing welcome message for returning customer');
            } else if (data.messages.length === 0) {
                this.showCustomerInfoForm();
                messagesContainer.innerHTML = '<div class="welcome-message">Welcome! Please enter your name and email to start chatting with our support team.</div>';
                console.log('Showing customer info form for new session');
            } else {
                this.showMessageInput();
                data.messages.forEach(message => this.displayMessage(message));
                this.scrollToBottom();
                console.log('Displayed existing messages:', data.messages.length);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesContainer.innerHTML = '<div class="loading-message">Error loading messages. Please try again.</div>';
        }
    }

    showCustomerInfoForm() {
        document.getElementById('customerInfo').style.display = 'block';
        document.getElementById('messageInputGroup').style.display = 'none';
        console.log('Showing customer info form');
    }

    showMessageInput() {
        document.getElementById('customerInfo').style.display = 'none';
        document.getElementById('messageInputGroup').style.display = 'flex';
        console.log('Showing message input');
    }

    saveCustomerInfo() {
        this.customerName = document.getElementById('customerName').value.trim();
        this.customerEmail = document.getElementById('customerEmail').value.trim();

        if (!this.customerName) {
            alert('Please enter your name');
            return;
        }

        if (!this.customerEmail) {
            alert('Please enter your email');
            return;
        }

        this.setStoredCustomerInfo(this.customerName, this.customerEmail);

        this.showMessageInput();
        this.addWelcomeMessage();

        this.updateSessionWithCustomerInfo();

        console.log('Customer info saved:', { name: this.customerName, email: this.customerEmail });
    }

    async updateSessionWithCustomerInfo() {
        try {
            await fetch(`${this.baseUrl}/api/chat/session/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    customer_name: this.customerName,
                    customer_email: this.customerEmail
                })
            });
            console.log('Session updated with customer info');
        } catch (error) {
            console.log('Failed to update session info:', error);
        }
    }

    addWelcomeMessage() {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                Hello ${this.escapeHtml(this.customerName)}! You're now connected to our support team. How can we help you today?
            </div>
        `;
        console.log('Added welcome message');
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        if (!this.customerName || !this.customerEmail) {
            alert('Please enter your name and email first');
            this.showCustomerInfoForm();
            return;
        }

        this.playNotificationSound();

        const tempMessage = {
            id: 'temp_' + Date.now(),
            session_id: this.sessionId,
            sender_type: 'customer',
            message: message,
            customer_name: this.customerName,
            created_at: new Date().toISOString(),
            read: false
        };

        this.displayMessage(tempMessage);
        messageInput.value = '';
        this.scrollToBottom();

        try {
            const response = await fetch(`${this.baseUrl}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message: message,
                    sender_type: 'customer',
                    customer_name: this.customerName,
                    customer_email: this.customerEmail
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error('Failed to send message');
            }

            const tempElement = document.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (tempElement) {
                tempElement.remove();
            }
            this.displayMessage(data.message);
            console.log('Message sent successfully');

        } catch (error) {
            console.error('Error sending message:', error);

            const tempElement = document.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (tempElement) {
                tempElement.innerHTML += ' <span style="color: #dc3545;">(Failed to send)</span>';
            }
        }
    }



    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    initPusher() {
        console.log('Initializing Pusher for customer chat...');


        if (typeof Pusher === 'undefined') {
            console.error('Pusher library not loaded. Retrying in 1s...');
            setTimeout(() => this.initPusher(), 1000);
            return;
        }

        try {
            if (!this.pusher) {
                this.pusher = new Pusher('f603781148035e119bff', {
                    cluster: 'ap2',
                    forceTLS: true,
                    enabledTransports: ['ws', 'wss']
                });

                console.log('Pusher initialized successfully');
            }

            this.pusher.connection.bind('connected', () => {
                console.log('Pusher connected successfully');
            });

            this.pusher.connection.bind('error', (err) => {
                console.error('Pusher connection error:', err);
            });

            // Subscribe to the channel
            const channelName = `chat.${this.sessionId}`;
            console.log(`Subscribing to channel: ${channelName}`);

            if (this.channel) {
                this.pusher.unsubscribe(channelName);
            }

            this.channel = this.pusher.subscribe(channelName);

            this.channel.bind('pusher:subscription_succeeded', () => {
                console.log(`Successfully subscribed to channel: ${channelName}`);
            });

            this.channel.bind('pusher:subscription_error', (err) => {
                console.error(`Subscription error for channel ${channelName}:`, err);
            });

            this.channel.bind('new.message', (data) => {
                console.log('Received real-time message:', data);
                this.displayMessage(data, true);

                if (data.sender_type === 'admin') {
                    this.showNotification();
                    this.playNotificationSound();
                }

                this.scrollToBottom();
            });

        } catch (error) {
            console.error('Error initializing Pusher:', error);
        }
    }


    showNotification() {
        if (!this.isOpen || this.isMinimized) {
            const badge = document.getElementById('notificationBadge');
            badge.style.display = 'flex';
            badge.textContent = '!';
            console.log('Notification badge shown');
        }
    }

    hideNotification() {
        const badge = document.getElementById('notificationBadge');
        badge.style.display = 'none';
        console.log('Notification badge hidden');
    }

    async checkUnreadMessages() {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat/messages?session_id=${this.sessionId}`);
            const data = await response.json();

            const unreadMessages = data.messages.filter(msg =>
                msg.sender_type === 'admin' && !msg.read
            );

            if (unreadMessages.length > 0 && (!this.isOpen || this.isMinimized)) {
                this.showNotification();
                console.log('Unread messages found:', unreadMessages.length);
            }
        } catch (error) {
            console.error('Error checking unread messages:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing chat widget...');

    const script = document.createElement('script');
    script.src = 'https://js.pusher.com/8.2.0/pusher.min.js';
    script.onload = function () {
        console.log('Pusher library loaded');
        new ChatWidget();
    };
    script.onerror = function () {
        console.error('Failed to load Pusher library');

        new ChatWidget();
    };
    document.head.appendChild(script);
});

window.ChatWidget = ChatWidget;