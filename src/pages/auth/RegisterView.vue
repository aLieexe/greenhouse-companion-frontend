<script setup lang="ts">
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, UserRound } from "lucide-vue-next";
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { getApiError } from "../../api/http";
import { useAuthStore } from "../../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const message = ref("");
const loading = ref(false);

async function handleRegister() {
    if (loading.value) {
        return;
    }

    message.value = "";

    if (username.value.length < 5 || username.value.length > 100) {
        message.value = "Username must be between 5 and 100 characters.";
        return;
    }

    if (password.value.length < 8 || password.value.length > 100) {
        message.value = "Password must be between 8 and 100 characters.";
        return;
    }

    if (password.value !== confirmPassword.value) {
        message.value = "Password and confirmation password do not match.";
        return;
    }

    loading.value = true;

    try {
        await auth.register(username.value, password.value);
        await router.push({ name: "Login", query: { registered: "1" } });
    } catch (err) {
        message.value = getApiError(err);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <main class="min-h-screen bg-[#f7faf7] flex items-center justify-center p-4 lg:p-8">
        <div
            class="w-full max-w-6xl min-h-[720px] bg-white rounded-3xl shadow-xl shadow-green-900/5 overflow-hidden grid lg:grid-cols-2"
        >
            <!-- Left: Branding Panel -->
            <section
                class="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 items-center justify-center p-12 order-2"
            >
                <div
                    class="absolute w-96 h-96 rounded-full border border-white/10 -top-32 -right-24"
                ></div>
                <div
                    class="absolute w-72 h-72 rounded-full border border-white/10 -bottom-20 -left-20"
                ></div>

                <div class="relative z-10 max-w-md text-white">
                    <div
                        class="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-8"
                    >
                        <Leaf :size="34" />
                    </div>

                    <p class="text-emerald-100 text-sm font-semibold tracking-[0.2em] mb-4">
                        START YOUR JOURNEY
                    </p>

                    <h2 class="text-4xl xl:text-5xl font-bold leading-tight">
                        Your greenhouse,
                        <span class="text-emerald-200">under control.</span>
                    </h2>

                    <p class="text-emerald-50/80 leading-relaxed mt-6 text-lg">
                        Create your account and take the first step toward smarter, more efficient
                        greenhouse management.
                    </p>

                    <div
                        class="mt-12 rounded-2xl bg-white/10 border border-white/10 p-6 backdrop-blur"
                    >
                        <p class="text-emerald-100 text-sm">Greenhouse Companion</p>
                        <p class="text-xl font-semibold mt-2">A smarter way to grow.</p>
                    </div>
                </div>
            </section>

            <!-- Right: Registration Form -->
            <section class="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16 order-1">
                <RouterLink to="/" class="flex items-center gap-3 w-fit mb-10">
                    <div
                        class="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white"
                    >
                        <Leaf :size="25" />
                    </div>
                    <span class="text-xl font-bold tracking-tight text-gray-900">
                        Greenhouse<span class="text-emerald-600">.</span>
                    </span>
                </RouterLink>

                <div class="max-w-md w-full mx-auto">
                    <p class="text-sm font-semibold text-emerald-600 mb-3">GET STARTED</p>

                    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        Create account
                    </h1>

                    <p class="text-gray-500 mt-3 mb-7">
                        Register to start managing your smart greenhouse.
                    </p>

                    <form @submit.prevent="handleRegister" class="space-y-4">
                        <div>
                            <label
                                for="username"
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Username
                            </label>
                            <div class="relative">
                                <UserRound
                                    class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                                    :size="19"
                                />
                                <input
                                    id="username"
                                    v-model="username"
                                    type="text"
                                    placeholder="Your username"
                                    autocomplete="username"
                                    minlength="5"
                                    maxlength="100"
                                    required
                                    class="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                for="password"
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password
                            </label>
                            <div class="relative">
                                <LockKeyhole
                                    class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                                    :size="19"
                                />
                                <input
                                    id="password"
                                    v-model="password"
                                    :type="showPassword ? 'text' : 'password'"
                                    placeholder="Create a password"
                                    minlength="8"
                                    maxlength="100"
                                    required
                                    class="w-full h-12 pl-12 pr-12 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                                />
                                <button
                                    type="button"
                                    @click="showPassword = !showPassword"
                                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    :aria-label="showPassword ? 'Hide password' : 'Show password'"
                                >
                                    <EyeOff v-if="showPassword" :size="19" />
                                    <Eye v-else :size="19" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label
                                for="confirmPassword"
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Confirm password
                            </label>
                            <div class="relative">
                                <LockKeyhole
                                    class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                                    :size="19"
                                />
                                <input
                                    id="confirmPassword"
                                    v-model="confirmPassword"
                                    :type="showPassword ? 'text' : 'password'"
                                    placeholder="Confirm your password"
                                    required
                                    class="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            :disabled="loading"
                            class="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <template v-if="loading"> Creating account... </template>
                            <template v-else>
                                Create Account
                                <ArrowRight :size="18" />
                            </template>
                        </button>

                        <p v-if="message" class="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                            {{ message }}
                        </p>
                    </form>

                    <p class="text-sm text-gray-500 text-center mt-7">
                        Already have an account?
                        <RouterLink
                            to="/login"
                            class="text-emerald-700 font-semibold hover:text-emerald-800"
                        >
                            Sign in
                        </RouterLink>
                    </p>
                </div>
            </section>
        </div>
    </main>
</template>
