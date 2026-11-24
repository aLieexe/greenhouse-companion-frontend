
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDevicesStore } from '../stores/devices'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    // Authentication pages
    {
      path: '/login',
      name: 'Login',
      component: () => import('../pages/auth/LoginView.vue'),
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../pages/auth/RegisterView.vue'),
      meta: {
        guestOnly: true,
      },
    },

    // Devices are managed outside of the device-scoped main menu
    {
      path: '/devices',
      component: () => import('../layouts/DevicesLayout.vue'),
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: '',
          name: 'Devices',
          component: () => import('../pages/dashboard/DevicesView.vue'),
          meta: {
            title: 'Devices',
            description:
              'Register and manage your greenhouse devices.',
          },
        },
      ],
    },

    // Device-scoped application layout
    {
      path: '/:deviceId',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: '',
          redirect: (to) => `/${to.params.deviceId}/dashboard`,
        },
        {
          path: 'dashboard',
          name: 'DeviceDashboard',
          component: () => import('../pages/dashboard/DashboardView.vue'),
          meta: {
            title: 'Dashboard Overview',
            description:
              'Monitor and manage your greenhouse environment from one place.',
          },
        },
        {
          path: 'monitoring',
          name: 'DeviceMonitoring',
          component: () =>
            import('../pages/dashboard/MonitoringView.vue'),
          meta: {
            title: 'Monitoring',
            description:
              'Monitor greenhouse sensor readings and historical data.',
          },
        },
        {
          path: 'device-control',
          name: 'DeviceControl',
          component: () =>
            import('../pages/dashboard/DeviceControlView.vue'),
          meta: {
            title: 'Device Control',
            description:
              'Manage your greenhouse actuators and equipment.',
          },
        },
        {
          path: 'configuration',
          name: 'DeviceConfiguration',
          component: () =>
            import('../pages/dashboard/ConfigurationView.vue'),
          meta: {
            title: 'Configuration',
            description:
              'Configure greenhouse device settings and automation.',
          },
        },
        {
          path: 'members',
          name: 'DeviceMembers',
          component: () =>
            import('../pages/dashboard/MembersView.vue'),
          meta: {
            title: 'Members',
            description:
              'Manage greenhouse members and their access roles.',
          },
        },
        {
          path: 'logs',
          name: 'DeviceLogs',
          component: () =>
            import('../pages/dashboard/LogsView.vue'),
          meta: {
            title: 'Logs & History',
            description:
              'Review device activity and system event history.',
          },
        },
      ],
    },

    {
      path: '/',
      redirect: '/devices',
    },

    {
      path: '/404',
      name: 'NotFound',
      component: () => import('../pages/errors/NotFoundView.vue'),
    },

    // Unknown routes
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404',
    },
  ],
})

// Navigation guard
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    const redirect = to.query.redirect

    if (
      typeof redirect === 'string' &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//')
    ) {
      return redirect
    }

    return '/devices'
  }

  if (typeof to.params.deviceId === 'string') {
    const devices = useDevicesStore()
    await devices.ensureLoaded()

    if (!devices.deviceById(to.params.deviceId)) {
      return { name: 'NotFound', query: { from: to.fullPath } }
    }
  }

  return true
})

export default router
