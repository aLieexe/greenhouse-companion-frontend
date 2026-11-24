
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, SearchX } from 'lucide-vue-next'
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-gray-50 p-5 sm:p-8">
    <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <SearchX :size="26" />
      </div>

      <p class="mt-6 text-4xl font-bold text-emerald-600">
        404
      </p>

      <h1 class="mt-2 text-2xl font-bold text-gray-900">
        Page not found
      </h1>

      <p class="mt-1 text-sm text-gray-500">
        This page doesn't exist, or the device isn't registered to your account.
      </p>

      <RouterLink
        to="/devices"
        class="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Back to devices
        <ArrowRight :size="18" />
      </RouterLink>
    </div>
  </main>
</template>
