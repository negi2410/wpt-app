<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'Admin Dashboard' }}</title>

    <script src="https://js.pusher.com/7.0/pusher.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body class="bg-gray-100">

<div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-800 text-white">
        <div class="p-4 font-bold text-lg border-b border-gray-700">Menu</div>
        <nav class="mt-4">
            <a href="{{ route('admin.chat') }}" class="block py-2.5 px-4 hover:bg-gray-700 {{ request()->routeIs('admin.chat') ? 'bg-gray-700' : '' }}">💬 LiveChat</a>
            <a href="#" class="block py-2.5 px-4 hover:bg-gray-700">🎫 Ticket Manager</a>
            <a href="#" class="block py-2.5 px-4 hover:bg-gray-700">📧 Email Builder</a>
        </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1">
        <header class="bg-white shadow p-4">
            <h2 class="font-semibold text-xl text-gray-800">{{ $header ?? 'Dashboard' }}</h2>
        </header>

        <section class="p-6">
            {{ $slot }}
        </section>
    </main>
</div>

@stack('scripts')
</body>
</html>
