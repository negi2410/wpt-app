<?php

use App\Http\Controllers\AdminChatController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\LiveChatController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicChatController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

});


Route::get('/admin/chat', function () {
    return view('admin.chat');
})->name('admin.chat');

// routes/web.php

// Public chat widget routes
Route::prefix('chat')->group(function () {
    Route::get('/widget.css', function () {
        return response(file_get_contents(public_path('css/chat-widget.css')))
            ->header('Content-Type', 'text/css')
            ->header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    });

    Route::get('/widget.js', function () {
        return response(file_get_contents(public_path('js/chat-widget.js')))
            ->header('Content-Type', 'application/javascript')
            ->header('Cache-Control', 'public, max-age=86400');
    });
});

// Admin routes


require __DIR__ . '/auth.php';
