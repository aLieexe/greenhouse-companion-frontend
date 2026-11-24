
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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

    // Main application layout
    {
      path: '/',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../pages/dashboard/DashboardView.vue'),
          meta: {
            title: 'Dashboard Overview',
            description:
              'Monitor and manage your greenhouse environment from one place.',
          },
        },
        {
          path: 'monitoring',
          name: 'Monitoring',
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
          name: 'Device Control',
          component: () =>
            import('../pages/dashboard/DeviceControlView.vue'),
          meta: {
            title: 'Device Control',
            description:
              'Manage your greenhouse actuators and equipment.',
          },
        },
        {
          path: 'devices',
          name: 'Devices',
          component: () =>
            import('../pages/dashboard/DevicesView.vue'),
          meta: {
            title: 'Devices',
            description:
              'Register and manage your greenhouse devices.',
          },
        },
        {
          path: 'configuration',
          name: 'Configuration',
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
          name: 'Members',
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
          name: 'Logs & History',
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

    // Unknown routes
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

// Navigation guard
router.beforeEach((to) => {
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

    return '/dashboard'
  }

  return true
})

export default router
