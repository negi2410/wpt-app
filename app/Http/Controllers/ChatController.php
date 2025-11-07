<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Events\NewChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    public function getMessages(Request $request)
    {
        $request->validate([
            'session_id' => 'required|string'
        ]);

        Log::info('Fetching messages for session: ' . $request->session_id);

        $session = ChatSession::where('session_id', $request->session_id)->first();

        if (!$session) {
            Log::info('No session found for: ' . $request->session_id);
            return response()->json(['messages' => []]);
        }

        $messages = ChatMessage::where('session_id', $request->session_id)
            ->orderBy('created_at', 'asc')
            ->get();

        Log::info('Found ' . $messages->count() . ' messages for session: ' . $request->session_id);

        ChatMessage::where('session_id', $request->session_id)
            ->where('sender_type', 'customer')
            ->where('read', false)
            ->update(['read' => true]);

        return response()->json(['messages' => $messages]);
    }

    public function sendMessage(Request $request)
    {
        $request->validate([
            'session_id' => 'required|string',
            'message' => 'required|string|max:1000',
            'sender_type' => 'required|in:customer,admin',
            'customer_name' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255'
        ]);

        Log::info('Sending message', $request->all());

        DB::beginTransaction();

        try {
            $session = ChatSession::firstOrCreate(
                ['session_id' => $request->session_id],
                [
                    'customer_name' => $request->customer_name,
                    'customer_email' => $request->customer_email,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'last_activity' => now()
                ]
            );

            $session->update([
                'last_activity' => now(),
                'is_active' => true
            ]);

            $chatMessage = ChatMessage::create([
                'session_id' => $request->session_id,
                'sender_type' => $request->sender_type,
                'message' => $request->message,
                'customer_name' => $request->customer_name,
                'customer_email' => $request->customer_email,
                'read' => $request->sender_type === 'admin'
            ]);

            DB::commit();

            Log::info('Message created successfully', [
                'message_id' => $chatMessage->id,
                'session_id' => $chatMessage->session_id,
                'sender_type' => $chatMessage->sender_type
            ]);

            try {
                Log::info('Attempting to broadcast message to channel: chat.' . $chatMessage->session_id);
                broadcast(new NewChatMessage($chatMessage));
                Log::info('Broadcast successful');
            } catch (\Exception $e) {
                Log::error('Broadcast failed: ' . $e->getMessage());
                // Don't fail the entire request if broadcast fails
            }

            return response()->json([
                'success' => true,
                'message' => $chatMessage
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Send message error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Failed to send message: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getSessions()
    {
        $sessions = ChatSession::withCount(['messages', 'unreadMessages'])
            ->orderBy('last_activity', 'desc')
            ->get();

        return response()->json(['sessions' => $sessions]);
    }

    public function getSessionMessages($sessionId)
    {
        $messages = ChatMessage::where('session_id', $sessionId)
            ->orderBy('created_at', 'asc')
            ->get();

        ChatMessage::where('session_id', $sessionId)
            ->where('sender_type', 'customer')
            ->where('read', false)
            ->update(['read' => true]);

        return response()->json(['messages' => $messages]);
    }

    public function closeSession($sessionId)
    {
        $session = ChatSession::where('session_id', $sessionId)->firstOrFail();
        $session->update(['is_active' => false]);

        return response()->json(['success' => true]);
    }

    public function heartbeat(Request $request)
    {
        try {
            $request->validate([
                'session_id' => 'required|string'
            ]);

            $session = ChatSession::firstOrCreate(
                ['session_id' => $request->session_id],
                [
                    'customer_name' => $request->customer_name,
                    'customer_email' => $request->customer_email,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'last_activity' => now(),
                    'is_active' => true
                ]
            );

            $session->update([
                'last_activity' => now(),
                'is_active' => true
            ]);

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            \Log::error('Heartbeat error: ' . $e->getMessage());
            return response()->json(['success' => false]);
        }
    }

    public function updateSession(Request $request)
    {
        try {
            $request->validate([
                'session_id' => 'required|string',
                'customer_name' => 'required|string',
                'customer_email' => 'required|email'
            ]);

            $session = ChatSession::where('session_id', $request->session_id)->first();

            if ($session) {
                $session->update([
                    'customer_name' => $request->customer_name,
                    'customer_email' => $request->customer_email,
                    'last_activity' => now()
                ]);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            \Log::error('Update session error: ' . $e->getMessage());
            return response()->json(['success' => false]);
        }
    }
}
