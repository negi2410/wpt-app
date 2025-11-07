<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'sender_type',
        'message',
        'customer_name',
        'customer_email',
        'read'
    ];

    protected $casts = [
        'read' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function session()
    {
        return $this->belongsTo(ChatSession::class, 'session_id', 'session_id');
    }

    public function isCustomer()
    {
        return $this->sender_type === 'customer';
    }

    public function isAdmin()
    {
        return $this->sender_type === 'admin';
    }
}