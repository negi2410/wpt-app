<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::middleware('api')->group(function () {

    
    Route::prefix('chat')->group(function () {
        Route::get('/messages', [ChatController::class, 'getMessages']);
        Route::post('/send', [ChatController::class, 'sendMessage']);
        Route::get('/sessions', [ChatController::class, 'getSessions']);
        Route::get('/session/{sessionId}/messages', [ChatController::class, 'getSessionMessages']);
        Route::post('/session/{sessionId}/close', [ChatController::class, 'closeSession']);
    });
});

Route::get('/chat/debug/pusher', function () {
    try {
        // Test Pusher connection
        $pusher = new Pusher\Pusher(
            env('PUSHER_APP_KEY'),
            env('PUSHER_APP_SECRET'),
            env('PUSHER_APP_ID'),
            [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => true
            ]
        );

        // Test broadcasting
        $testData = [
            'message' => 'Test message from Pusher',
            'timestamp' => now()->toDateTimeString()
        ];

        $response = $pusher->trigger('chat.test', 'test.event', $testData);

        return response()->json([
            'status' => 'success',
            'pusher_connected' => true,
            'broadcast_response' => $response,
            'test_data' => $testData
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
            'pusher_config' => [
                'app_id' => env('PUSHER_APP_ID'),
                'app_key' => env('PUSHER_APP_KEY'),
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'secret' => env('PUSHER_APP_SECRET') ? '***' : 'missing'
            ]
        ], 500);
    }
});

Route::get('/chat/debug/event/{sessionId}', function ($sessionId) {
    try {
        // Test event broadcasting for a specific session
        event(new App\Events\NewChatMessage(
            new App\Models\ChatMessage([
                'id' => 9999,
                'session_id' => $sessionId,
                'sender_type' => 'admin',
                'message' => 'Test real-time message',
                'customer_name' => 'Test User',
                'customer_email' => 'test@example.com',
                'read' => false,
                'created_at' => now()
            ])
        ));

        return response()->json([
            'status' => 'success',
            'message' => 'Test event fired for session: ' . $sessionId,
            'channel' => 'chat.' . $sessionId,
            'event' => 'new.message'
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage()
        ], 500);
    }
});

Route::post('/chat/session/heartbeat', [ChatController::class, 'heartbeat']);
Route::post('/chat/session/update', [ChatController::class, 'updateSession']);