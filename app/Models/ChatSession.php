<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'customer_name',
        'customer_email',
        'ip_address',
        'user_agent',
        'last_activity',
        'is_active'
    ];

    protected $casts = [
        'last_activity' => 'datetime',
        'is_active' => 'boolean'
    ];

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'session_id', 'session_id');
    }

    public function unreadMessages()
    {
        return $this->messages()->where('read', false)->where('sender_type', 'customer');
    }

    public function markAsRead()
    {
        $this->messages()->where('read', false)->update(['read' => true]);
    }
}