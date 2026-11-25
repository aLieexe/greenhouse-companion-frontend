
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  AlertCircle,
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  Shield,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Check,
  Crown,
  RefreshCw,
} from 'lucide-vue-next'

import {
  addMember,
  listMembers,
  removeMember as removeMemberRequest,
  updateMemberRole,
} from '../../api/members'
import { getApiError } from '../../api/http'
import { useDevicesStore } from '../../stores/devices'
import type { DeviceMember, DeviceRole, MemberAssignableRole } from '../../types/api'

const route = useRoute()
const devicesStore = useDevicesStore()
const deviceId = computed(() => String(route.params.deviceId ?? ''))

const deviceName = computed(
  () => devicesStore.deviceById(deviceId.value)?.name ?? 'this device',
)
const isOwner = computed(
  () => devicesStore.deviceById(deviceId.value)?.role === 'owner',
)

const members = ref<DeviceMember[]>([])
const membersLoading = ref(false)
const membersError = ref('')
const actionError = ref('')

let loadToken = 0

const searchQuery = ref('')
const roleFilter = ref('all')
const activeMenu = ref<string | null>(null)

const filteredMembers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return members.value.filter((member) => {
    const matchesSearch =
      !query ||
      member.username.toLowerCase().includes(query) ||
      member.user_id.toLowerCase().includes(query)

    const matchesRole =
      roleFilter.value === 'all' || member.role === roleFilter.value

    return matchesSearch && matchesRole
  })
})

async function loadMembers(id: string) {
  const token = ++loadToken
  membersLoading.value = true
  membersError.value = ''

  try {
    const response = await listMembers(id)
    if (id !== deviceId.value || token !== loadToken) return

    members.value = response
    actionError.value = ''
  } catch (err) {
    if (id !== deviceId.value || token !== loadToken) return
    membersError.value = getApiError(err)
  } finally {
    if (id === deviceId.value && token === loadToken) membersLoading.value = false
  }
}

// Modal state
const isModalOpen = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingUserId = ref<string | null>(null)

const memberForm = reactive({
  username: '',
  role: 'viewer' as MemberAssignableRole,
})

const formError = ref('')
const successMessage = ref('')

function openAddModal() {
  modalMode.value = 'add'
  editingUserId.value = null
  memberForm.username = ''
  memberForm.role = 'viewer'
  formError.value = ''
  isModalOpen.value = true
  activeMenu.value = null
}

function openEditModal(member: DeviceMember) {
  if (member.role === 'owner') return

  modalMode.value = 'edit'
  editingUserId.value = member.user_id
  memberForm.username = member.username
  memberForm.role = member.role === 'viewer' ? 'viewer' : 'admin'
  formError.value = ''
  isModalOpen.value = true
  activeMenu.value = null
}

function closeModal() {
  isModalOpen.value = false
  formError.value = ''
}

async function saveMember() {
  const username = memberForm.username.trim()

  if (!username || username.length > 64) {
    formError.value = 'Username must be between 1 and 64 characters.'
    return
  }

  const id = deviceId.value
  const role = memberForm.role
  const editingId = editingUserId.value

  if (modalMode.value === 'edit' && !editingId) return

  try {
    if (modalMode.value === 'add') {
      await addMember(id, { username, role })
    } else if (editingId) {
      await updateMemberRole(id, editingId, { role })
    }

    if (id !== deviceId.value) return

    const message =
      modalMode.value === 'add'
        ? `${username} has been added to the device.`
        : `${username}'s role has been updated.`

    closeModal()
    await loadMembers(id)
    if (id !== deviceId.value) return

    showSuccess(message)
  } catch (err) {
    if (id !== deviceId.value) return
    formError.value = getApiError(err)
  }
}

async function removeMember(member: DeviceMember) {
  activeMenu.value = null

  if (member.role === 'owner') return

  const confirmed = window.confirm(
    `Remove ${member.username} from ${deviceName.value}?`,
  )
  if (!confirmed) return

  const id = deviceId.value

  try {
    await removeMemberRequest(id, member.user_id)
    if (id !== deviceId.value) return

    await loadMembers(id)
    if (id !== deviceId.value) return

    showSuccess(`${member.username} has been removed.`)
  } catch (err) {
    if (id !== deviceId.value) return
    actionError.value = getApiError(err)
  }
}

function showSuccess(message: string) {
  actionError.value = ''
  successMessage.value = message
  window.setTimeout(() => {
    if (successMessage.value === message) {
      successMessage.value = ''
    }
  }, 3000)
}

function toggleMenu(userId: string) {
  activeMenu.value = activeMenu.value === userId ? null : userId
}

function roleLabel(role: DeviceRole) {
  const labels: Record<DeviceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    viewer: 'Viewer',
  }

  return labels[role]
}

function roleDescription(role: DeviceRole) {
  const descriptions: Record<DeviceRole, string> = {
    owner: 'Full device ownership and member management.',
    admin: 'Can manage device settings and operations.',
    viewer: 'Can view device information and monitoring data.',
  }

  return descriptions[role]
}

onMounted(() => {
  void loadMembers(deviceId.value)
})

watch(deviceId, (id) => {
  loadToken++
  members.value = []
  membersLoading.value = false
  membersError.value = ''
  actionError.value = ''
  searchQuery.value = ''
  roleFilter.value = 'all'
  activeMenu.value = null
  closeModal()

  void loadMembers(id)
})
</script>

<template>
  <div class="space-y-6 pb-8">
    <!-- Page Introduction -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h3 class="text-2xl font-bold text-gray-900">
          Members
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          Manage greenhouse members and their access roles.
        </p>
      </div>

      <button
        v-if="isOwner"
        type="button"
        @click="openAddModal"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <UserPlus class="h-4 w-4" />
        Add Member
      </button>
    </div>

    <!-- Success notification -->
    <Transition name="fade">
      <div
        v-if="successMessage"
        class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        <Check class="h-4 w-4 shrink-0" />
        {{ successMessage }}
      </div>
    </Transition>

    <section
      v-if="membersError"
      class="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"
    >
      <AlertCircle :size="28" class="mx-auto text-rose-600" />
      <p class="mt-3 text-sm font-semibold text-rose-800">
        Unable to load members
      </p>
      <p class="mt-1 text-sm text-rose-700">
        {{ membersError }}
      </p>
      <button
        type="button"
        @click="loadMembers(deviceId)"
        class="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
      >
        <RefreshCw :size="16" />
        Retry
      </button>
    </section>

    <section
      v-else-if="membersLoading"
      class="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <RefreshCw :size="28" class="animate-spin text-emerald-600" />
    </section>

    <template v-else>
    <!-- Role information -->
    <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
      <div class="mb-4 flex items-center gap-2">
        <Shield class="h-5 w-5 text-emerald-700" />
        <h2 class="text-sm font-semibold text-gray-900">
          Access Roles
        </h2>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <p class="text-sm font-semibold text-amber-800">Owner</p>
          <p class="mt-1 text-xs leading-relaxed text-gray-600">
            Full device ownership and member management.
          </p>
        </div>
        <div>
          <p class="text-sm font-semibold text-blue-800">Admin</p>
          <p class="mt-1 text-xs leading-relaxed text-gray-600">
            Can manage device settings and operations.
          </p>
        </div>
        <div>
          <p class="text-sm font-semibold text-violet-800">Viewer</p>
          <p class="mt-1 text-xs leading-relaxed text-gray-600">
            Can view device information and monitoring data.
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="actionError"
      class="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      <AlertCircle class="h-4 w-4 shrink-0" />
      {{ actionError }}
    </div>

    <!-- Members table -->
    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        class="flex flex-col justify-between gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center"
      >
        <div>
          <h2 class="font-semibold text-gray-900">Device Members</h2>
          <p class="mt-1 text-xs text-gray-500">
            Manage access for {{ deviceName }}.
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row">
          <div class="relative">
            <Search
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search members..."
              class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-56"
            />
          </div>

          <div class="relative">
            <select
              v-model="roleFilter"
              class="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-9 text-sm text-gray-700 outline-none transition focus:border-emerald-500 sm:w-36"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <ChevronDown
              class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>
      </div>

      <!-- Desktop table -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Member
              </th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                User ID
              </th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="member in filteredMembers"
              :key="member.user_id"
              class="transition hover:bg-gray-50/70"
            >
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold uppercase text-emerald-700"
                  >
                    {{ member.username.slice(0, 2) }}
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-900">
                      {{ member.username }}
                    </p>
                    <p class="text-xs text-gray-400">Device member</p>
                  </div>
                </div>
              </td>

              <td class="px-6 py-4">
                <span class="font-mono text-xs text-gray-500">
                  {{ member.user_id }}
                </span>
              </td>

              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="{
                    'bg-amber-50 text-amber-700': member.role === 'owner',
                    'bg-blue-50 text-blue-700': member.role === 'admin',
                    'bg-violet-50 text-violet-700': member.role === 'viewer',
                  }"
                >
                  <Crown v-if="member.role === 'owner'" class="h-3.5 w-3.5" />
                  <ShieldCheck v-else-if="member.role === 'admin'" class="h-3.5 w-3.5" />
                  <Eye v-else class="h-3.5 w-3.5" />
                  {{ roleLabel(member.role) }}
                </span>
              </td>

              <td class="px-6 py-4 text-right">
                <div class="relative inline-block">
                  <button
                    v-if="isOwner"
                    type="button"
                    @click="toggleMenu(member.user_id)"
                    class="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Member actions"
                  >
                    <MoreHorizontal class="h-5 w-5" />
                  </button>

                  <div
                    v-if="activeMenu === member.user_id"
                    class="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-1 text-left shadow-lg"
                  >
                    <button
                      v-if="member.role !== 'owner'"
                      type="button"
                      @click="openEditModal(member)"
                      class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                    >
                      <Pencil class="h-4 w-4" />
                      Edit Role
                    </button>
                    <button
                      type="button"
                      @click="removeMember(member)"
                      :disabled="member.role === 'owner'"
                      class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 class="h-4 w-4" />
                      Remove Member
                    </button>
                  </div>
                </div>
              </td>
            </tr>

            <tr v-if="filteredMembers.length === 0">
              <td colspan="4" class="px-6 py-12 text-center">
                <Users class="mx-auto h-8 w-8 text-gray-300" />
                <p class="mt-3 text-sm font-medium text-gray-700">
                  No members found
                </p>
                <p class="mt-1 text-xs text-gray-400">
                  Try changing your search or role filter.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="divide-y divide-gray-100 md:hidden">
        <div
          v-for="member in filteredMembers"
          :key="member.user_id"
          class="flex items-center justify-between gap-3 p-4"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold uppercase text-emerald-700"
            >
              {{ member.username.slice(0, 2) }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-gray-900">
                {{ member.username }}
              </p>
              <p class="truncate font-mono text-xs text-gray-400">
                {{ member.user_id }}
              </p>
              <span
                class="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="{
                  'bg-amber-50 text-amber-700': member.role === 'owner',
                  'bg-blue-50 text-blue-700': member.role === 'admin',
                  'bg-violet-50 text-violet-700': member.role === 'viewer',
                }"
              >
                {{ roleLabel(member.role) }}
              </span>
            </div>
          </div>

          <div v-if="isOwner" class="flex shrink-0 gap-1">
            <button
              v-if="member.role !== 'owner'"
              type="button"
              @click="openEditModal(member)"
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Edit role"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              type="button"
              @click="removeMember(member)"
              :disabled="member.role === 'owner'"
              class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Remove member"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          v-if="filteredMembers.length === 0"
          class="px-6 py-12 text-center"
        >
          <Users class="mx-auto h-8 w-8 text-gray-300" />
          <p class="mt-3 text-sm font-medium text-gray-700">
            No members found
          </p>
          <p class="mt-1 text-xs text-gray-400">
            Try changing your search or role filter.
          </p>
        </div>
      </div>

      <div class="border-t border-gray-100 px-5 py-3">
        <p class="text-xs text-gray-400">
          Showing {{ filteredMembers.length }} of {{ members.length }} members
        </p>
      </div>
    </div>
    </template>

    <!-- Add/Edit modal -->
    <Transition name="modal">
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div class="mb-5 flex items-start justify-between">
            <div>
              <h2 class="text-lg font-bold text-gray-900">
                {{ modalMode === 'add' ? 'Add New Member' : 'Edit Member Role' }}
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                {{
                  modalMode === 'add'
                    ? 'Give a user access to this device.'
                    : 'Change the access level for this member.'
                }}
              </p>
            </div>
            <button
              type="button"
              @click="closeModal"
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close modal"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="saveMember" class="space-y-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                v-model="memberForm.username"
                type="text"
                :disabled="modalMode === 'edit'"
                placeholder="Enter registered username"
                class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-500"
              />
              <p class="mt-1.5 text-xs text-gray-400">
                Enter the username of an existing registered user.
              </p>
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                Access Role
              </label>
              <div class="space-y-2">
                <label
                  v-for="role in (['admin', 'viewer'] as MemberAssignableRole[])"
                  :key="role"
                  class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition"
                  :class="
                    memberForm.role === role
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  "
                >
                  <input
                    v-model="memberForm.role"
                    type="radio"
                    :value="role"
                    class="mt-1 accent-emerald-600"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-gray-800">
                      {{ roleLabel(role) }}
                    </p>
                    <p class="mt-0.5 text-xs text-gray-500">
                      {{ roleDescription(role) }}
                    </p>
                  </div>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-400">
                Owner access cannot be assigned through this form.
              </p>
            </div>

            <p
              v-if="formError"
              class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"
            >
              {{ formError }}
            </p>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                @click="closeModal"
                class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {{ modalMode === 'add' ? 'Add Member' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: translateY(10px);
}
</style>

