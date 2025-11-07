<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\ChatMessage;

class NewChatMessage implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $chatMessage;

    public function __construct(ChatMessage $chatMessage)
    {
        $this->chatMessage = $chatMessage;
    }

    public function broadcastOn()
    {
        return new Channel('chat.' . $this->chatMessage->session_id);
    }

    public function broadcastAs()
    {
        return 'new.message';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->chatMessage->id,
            'session_id' => $this->chatMessage->session_id,
            'sender_type' => $this->chatMessage->sender_type,
            'message' => $this->chatMessage->message,
            'customer_name' => $this->chatMessage->customer_name,
            'customer_email' => $this->chatMessage->customer_email,
            'created_at' => $this->chatMessage->created_at->toDateTimeString(),
            'read' => $this->chatMessage->read,
        ];
    }

    public function broadcastWhen()
    {
        return true;
    }
}