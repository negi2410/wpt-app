<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Laravel') }}</title>

    <script src="https://js.pusher.com/7.0/pusher.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
    
    {{ $head ?? '' }}
    <!-- Scripts -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])

</head>

<body class="font-sans antialiased">
    <div class="min-h-screen bg-gray-100 flex">
        {{-- Sidebar --}}
        <aside class="w-64 bg-gray-800 text-white flex-shrink-0 min-h-screen">
            <div class="p-4 font-bold text-lg border-b border-gray-700">Menu</div>
            <nav class="mt-4">
                <a href="{{ route('admin.chat') }}"
                    class="block py-2.5 px-4 hover:bg-gray-700 {{ request()->routeIs('admin.chat') ? 'bg-gray-700' : '' }}">💬
                    LiveChat</a>
                <a href="#" class="block py-2.5 px-4 hover:bg-gray-700">🎫 Ticket Manager</a>
                <a href="#" class="block py-2.5 px-4 hover:bg-gray-700">📧 Email Builder</a>
            </nav>
        </aside>

        {{-- Main Content --}}
        <div class="flex-1 flex flex-col">
            {{-- Top Navigation --}}
            @include('layouts.navigation')

            {{-- Page Heading --}}
            @isset($header)
                <header class="bg-white shadow">
                    <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                        {{ $header }}
                    </div>
                </header>
            @endisset

            {{-- Page Content --}}
            <main class="flex-1 p-6">
                {{ $slot }}
            </main>
        </div>
    </div>
</body>

</html>
