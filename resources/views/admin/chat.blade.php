<x-app-layout>    
    
    <x-slot name="head">
        <link rel="stylesheet" href="{{ asset('css/admin-chat.css') }}">
    </x-slot>

    <div class="admin-chat-container">
        <div class="sessions-sidebar">
            <div class="sidebar-header">
                <h1>Chat Sessions</h1>
            </div>
            <div class="sessions-list" id="sessionsList">
                <div class="loading">Loading sessions...</div>
            </div>
        </div>

        <div class="chat-area">
            <div id="noSession" class="no-session-selected">
                Please select a chat session to start messaging
            </div>

            <div id="activeChat" style="display: none; flex-direction: column; height: 100%;">
                <div class="chat-header">
                    <div class="chat-customer-info">
                        <h2 id="activeCustomerName">Customer Name</h2>
                        <div class="email" id="activeCustomerEmail">customer@example.com</div>
                    </div>
                    <div class="chat-actions">
                        <button id="btnCloseSession">Close Session</button>
                    </div>
                </div>

                <div class="messages-container" id="adminMessagesContainer">

                </div>

                <div class="chat-input-area">
                    <div class="message-input-group">
                        <textarea id="adminMessageInput" placeholder="Type your response..." maxlength="1000" disabled></textarea>
                        <button id="btnAdminSend" disabled>Send</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        class AdminChat {
            constructor() {
                this.currentSession = null;
                this.pusher = null;
                this.sessions = [];
                this.baseUrl = '{{ url('/') }}';

                this.init();
            }

            init() {
                this.initPusher();
                this.loadSessions();
                this.bindEvents();

                setInterval(() => this.loadSessions(), 30000);
            }

            bindEvents() {

                document.getElementById('btnAdminSend').addEventListener('click', () => this.sendMessage());
                document.getElementById('adminMessageInput').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });

                document.getElementById('btnCloseSession').addEventListener('click', () => this.closeSession());
            }

            async loadSessions() {
                try {
                    const response = await axios.get(`${this.baseUrl}/api/chat/sessions`);
                    this.sessions = response.data.sessions;
                    this.renderSessions();
                } catch (error) {
                    console.error('Error loading sessions:', error);
                }
            }

            renderSessions() {
                const sessionsList = document.getElementById('sessionsList');

                if (this.sessions.length === 0) {
                    sessionsList.innerHTML = '<div class="empty-state">No active chat sessions</div>';
                    return;
                }

                sessionsList.innerHTML = this.sessions.map(session => `
                    <div class="session-item ${this.currentSession?.session_id === session.session_id ? 'active' : ''}" 
                         onclick="adminChat.selectSession('${session.session_id}')">
                        <div class="session-customer">
                            ${session.customer_name || 'Anonymous'}
                            ${session.unread_messages_count > 0 ? 
                                `<span class="unread-badge">${session.unread_messages_count}</span>` : ''}
                        </div>
                        <div class="session-email">${session.customer_email || 'No email'}</div>
                        <div class="session-meta">
                            <span>${new Date(session.last_activity).toLocaleDateString()}</span>
                            <span>${session.messages_count} messages</span>
                        </div>
                    </div>
                `).join('');
            }

            async selectSession(sessionId) {
                this.currentSession = this.sessions.find(s => s.session_id === sessionId);

                document.getElementById('noSession').style.display = 'none';
                document.getElementById('activeChat').style.display = 'flex';

                document.getElementById('activeCustomerName').textContent =
                    this.currentSession.customer_name || 'Anonymous';
                document.getElementById('activeCustomerEmail').textContent =
                    this.currentSession.customer_email || 'No email provided';

                document.getElementById('adminMessageInput').disabled = false;
                document.getElementById('btnAdminSend').disabled = false;

                await this.loadSessionMessages();

                this.renderSessions();
            }

            async loadSessionMessages() {
                if (!this.currentSession) return;

                const messagesContainer = document.getElementById('adminMessagesContainer');
                messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';

                try {
                    const response = await axios.get(
                        `${this.baseUrl}/api/chat/session/${this.currentSession.session_id}/messages`
                    );

                    messagesContainer.innerHTML = '';

                    response.data.messages.forEach(message => {
                        this.displayMessage(message);
                    });

                    this.scrollToBottom();
                } catch (error) {
                    console.error('Error loading messages:', error);
                    messagesContainer.innerHTML = '<div class="loading">Error loading messages</div>';
                }
            }

            // displayMessage(message) {
            //     const messagesContainer = document.getElementById('adminMessagesContainer');
            //     const messageElement = document.createElement('div');
            //     messageElement.className = `message ${message.sender_type}`;

            //     const time = new Date(message.created_at).toLocaleTimeString([], {
            //         hour: '2-digit',
            //         minute: '2-digit'
            //     });

            //     messageElement.innerHTML = `
        //         <div class="message-bubble">
        //             <div class="message-text">${this.escapeHtml(message.message)}</div>
        //             <div class="message-time">${time}</div>
        //         </div>
        //     `;

            //     messagesContainer.appendChild(messageElement);
            // }

            async sendMessage() {
                const input = document.getElementById('adminMessageInput');
                const message = input.value.trim();

                if (!message || !this.currentSession) return;

                const tempMessage = {
                    id: 'temp_' + Date.now(),
                    session_id: this.currentSession.session_id,
                    sender_type: 'admin',
                    message: message,
                    created_at: new Date().toISOString(),
                    read: true
                };

                // this.displayMessage(tempMessage);
                input.value = '';
                //  this.scrollToBottom();

                try {
                    const response = await axios.post(`${this.baseUrl}/api/chat/send`, {
                        session_id: this.currentSession.session_id,
                        message: message,
                        sender_type: 'admin'
                    });

                    const messages = document.querySelectorAll('.message');
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage && lastMessage.querySelector('.message-text').textContent === message) {
                        lastMessage.remove();
                    }

                    this.displayMessage(response.data.message);
                    this.scrollToBottom();

                } catch (error) {
                    console.error('Error sending message:', error);

                    const messages = document.querySelectorAll('.message');
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage) {
                        lastMessage.innerHTML += ' <span style="color: #dc3545;">(Failed to send)</span>';
                    }
                }
            }

            async closeSession() {
                if (!this.currentSession) return;

                if (!confirm('Are you sure you want to close this chat session?')) {
                    return;
                }

                try {
                    await axios.post(
                        `${this.baseUrl}/api/chat/session/${this.currentSession.session_id}/close`
                    );

                    this.currentSession = null;
                    document.getElementById('noSession').style.display = 'flex';
                    document.getElementById('activeChat').style.display = 'none';
                    document.getElementById('adminMessageInput').value = '';

                    this.loadSessions();

                } catch (error) {
                    console.error('Error closing session:', error);
                    alert('Error closing session');
                }
            }

            scrollToBottom() {
                const messagesContainer = document.getElementById('adminMessagesContainer');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // initPusher() {
            //     this.pusher = new Pusher('f603781148035e119bff', { // Replace with your Pusher key
            //         cluster: 'ap2', // Replace with your Pusher cluster
            //         forceTLS: true
            //     });

            //     // Listen for all chat channels
            //     this.pusher.bind_global((eventName, data) => {
            //         if (eventName === 'new.message' && data.sender_type === 'customer') {
            //             // Refresh sessions to update unread counts
            //             this.loadSessions();

            //             // If this is the current session, add the message
            //             if (this.currentSession && this.currentSession.session_id === data.session_id) {
            //                 this.displayMessage(data);
            //                 this.scrollToBottom();
            //             }
            //         }
            //     });
            // }

            initPusher() {
                this.pusher = new Pusher('f603781148035e119bff', {
                    cluster: 'ap2',
                    forceTLS: true
                });

                console.log('Pusher initialized for admin');

                this.pusher.connection.bind('connected', () => {
                    console.log('Pusher connected successfully in admin');
                });

                this.pusher.connection.bind('error', (err) => {
                    console.error('Pusher connection error in admin:', err);
                });
            }

            subscribeToSession(sessionId) {
                if (!this.pusher) {
                    console.error('Pusher not initialized');
                    return;
                }

                if (this.currentChannel) {
                    this.pusher.unsubscribe(this.currentChannel);
                    console.log('Unsubscribed from previous channel:', this.currentChannel);
                }

                const channelName = `chat.${sessionId}`;
                console.log('Admin subscribing to channel:', channelName);

                try {
                    this.currentChannel = channelName;
                    const channel = this.pusher.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        console.log('Admin successfully subscribed to:', channelName);
                    });

                    channel.bind('pusher:subscription_error', (err) => {
                        console.error('Admin subscription error:', err);
                    });


                    channel.bind('new.message', (data) => {
                        console.log('dmin received real-time message:', data);

                        if (this.currentSession && this.currentSession.session_id === data.session_id) {
                            this.displayMessage(data);
                            this.scrollToBottom();

                            this.markMessageAsRead(data.id);
                        }

                        this.loadSessions();
                    });

                } catch (error) {
                    console.error('Error subscribing to session:', error);
                }
            }

            async markMessageAsRead(messageId) {
                try {
                    await axios.post(`${this.baseUrl}/api/chat/message/${messageId}/read`);
                    console.log('Message marked as read:', messageId);
                } catch (error) {
                    console.error('Error marking message as read:', error);
                }
            }

            async selectSession(sessionId) {
                this.currentSession = this.sessions.find(s => s.session_id === sessionId);

                document.getElementById('noSession').style.display = 'none';
                document.getElementById('activeChat').style.display = 'flex';

                document.getElementById('activeCustomerName').textContent =
                    this.currentSession.customer_name || 'Anonymous';
                document.getElementById('activeCustomerEmail').textContent =
                    this.currentSession.customer_email || 'No email provided';

                document.getElementById('adminMessageInput').disabled = false;
                document.getElementById('btnAdminSend').disabled = false;

                this.subscribeToSession(sessionId);

                await this.loadSessionMessages();

                await this.markAllMessagesAsRead(sessionId);

                this.renderSessions();
            }

            async markAllMessagesAsRead(sessionId) {
                try {
                    await axios.post(`${this.baseUrl}/api/chat/session/${sessionId}/read`);
                    console.log('All messages marked as read for session:', sessionId);
                } catch (error) {
                    console.error('Error marking messages as read:', error);
                }
            }

            displayMessage(message) {
                const messagesContainer = document.getElementById('adminMessagesContainer');
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
            <div class="message-time">${time}</div>
        </div>
    `;

                messagesContainer.appendChild(messageElement);
            }

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            window.adminChat = new AdminChat();
        });
    </script>
</x-app-layout>
