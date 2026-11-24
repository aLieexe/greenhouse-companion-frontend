<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
)

interface Props {
  labels: string[]
  values: (number | null)[]
  label: string
  color: string
  unit: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 'h-64',
})

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: props.label,
      data: props.values,
      borderColor: props.color,
      backgroundColor: `${props.color}18`,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: props.color,
      tension: 0.4,
      fill: true,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    intersect: false,
    mode: 'index',
  },

  plugins: {
    legend: {
      display: false,
    },

    tooltip: {
      backgroundColor: '#111827',
      padding: 12,
      titleFont: {
        size: 12,
      },
      bodyFont: {
        size: 12,
      },
      callbacks: {
        label: (context) => `${context.parsed.y} ${props.unit}`,
      },
    },
  },

  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#9ca3af',
        font: {
          size: 11,
        },
      },
      border: {
        display: false,
      },
    },

    y: {
      beginAtZero: false,
      grid: {
        color: '#f3f4f6',
      },
      ticks: {
        color: '#9ca3af',
        font: {
          size: 11,
        },
        callback: (value) => `${value} ${props.unit}`,
      },
      border: {
        display: false,
      },
    },
  },
}))
</script>

<template>
  <div :class="[props.height, 'w-full']">
    <Line
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>
