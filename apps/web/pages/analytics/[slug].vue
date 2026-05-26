<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-8">
      <button
        @click="navigateTo('/')"
        class="text-sm text-gray-400 hover:text-gray-200 mb-4 inline-flex items-center gap-2 transition-colors"
      >
        ← Back to Dashboard
      </button>
      <h1 class="text-3xl font-bold mb-2">Analytics</h1>
      <div v-if="urlInfo" class="text-gray-400">
        <code class="text-blue-400">{{ getShortUrl(slug) }}</code>
        <div class="text-sm mt-1 truncate">{{ urlInfo.original_url }}</div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading analytics...
    </div>

    <div v-else-if="error" class="bg-dark-card border border-red-500/30 rounded-lg p-6 text-center">
      <div class="text-red-400 mb-2">{{ error }}</div>
      <button
        @click="navigateTo('/')"
        class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        Return to Dashboard
      </button>
    </div>

    <div v-else>
      <!-- Overview Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <div class="text-gray-400 text-sm mb-2">Total Clicks</div>
          <div class="text-4xl font-bold text-blue-400">{{ analytics.total_clicks }}</div>
        </div>
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <div class="text-gray-400 text-sm mb-2">Unique Visitors</div>
          <div class="text-4xl font-bold text-purple-400">{{ analytics.unique_ips }}</div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="bg-dark-card border border-dark-border rounded-lg p-6 mb-8">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-semibold">Click Timeline</h2>
          <select
            v-model="timelineDays"
            @change="loadTimeline"
            class="bg-dark-bg border border-dark-border rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
          >
            <option :value="7">Last 7 days</option>
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
          </select>
        </div>
        
        <div v-if="timeline.length === 0" class="text-center py-8 text-gray-400">
          No clicks in the selected period
        </div>
        
        <div v-else class="space-y-2">
          <div
            v-for="item in timeline"
            :key="item.date"
            class="flex items-center gap-3"
          >
            <div class="text-sm text-gray-400 w-24">{{ formatTimelineDate(item.date) }}</div>
            <div class="flex-1 bg-dark-bg rounded-full h-8 relative overflow-hidden">
              <div
                class="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all"
                :style="{ width: `${(item.clicks / maxClicks) * 100}%` }"
              ></div>
              <div class="absolute inset-0 flex items-center px-3 text-sm font-medium">
                {{ item.clicks }} clicks
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Top Countries -->
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">Top Countries</h2>
          <div v-if="analytics.top_countries.length === 0" class="text-center py-4 text-gray-400">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in analytics.top_countries"
              :key="item.country"
              class="flex justify-between items-center"
            >
              <span class="text-gray-300">{{ item.country }}</span>
              <span class="text-blue-400 font-medium">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <!-- Top Devices -->
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">Device Types</h2>
          <div v-if="analytics.top_devices.length === 0" class="text-center py-4 text-gray-400">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in analytics.top_devices"
              :key="item.device_type"
              class="flex justify-between items-center"
            >
              <span class="text-gray-300">{{ item.device_type }}</span>
              <span class="text-purple-400 font-medium">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <!-- Top Browsers -->
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">Top Browsers</h2>
          <div v-if="analytics.top_browsers.length === 0" class="text-center py-4 text-gray-400">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in analytics.top_browsers"
              :key="item.browser"
              class="flex justify-between items-center"
            >
              <span class="text-gray-300">{{ item.browser }}</span>
              <span class="text-green-400 font-medium">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <!-- Top Referers -->
        <div class="bg-dark-card border border-dark-border rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">Top Referers</h2>
          <div v-if="analytics.top_referers.length === 0" class="text-center py-4 text-gray-400">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in analytics.top_referers"
              :key="item.referer"
              class="flex justify-between items-center"
            >
              <span class="text-gray-300 truncate flex-1 mr-2">{{ item.referer }}</span>
              <span class="text-yellow-400 font-medium">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const slug = route.params.slug
const loading = ref(true)
const error = ref(null)
const urlInfo = ref(null)
const analytics = ref({
  total_clicks: 0,
  unique_ips: 0,
  top_countries: [],
  top_devices: [],
  top_browsers: [],
  top_referers: []
})
const timeline = ref([])
const timelineDays = ref(30)

const maxClicks = computed(() => {
  return Math.max(...timeline.value.map(t => t.clicks), 1)
})

const loadUrlInfo = async () => {
  try {
    const response = await fetch(`${apiBase}/info/${slug}`)
    if (!response.ok) throw new Error('URL not found')
    urlInfo.value = await response.json()
  } catch (err) {
    error.value = err.message
  }
}

const loadAnalytics = async () => {
  try {
    const response = await fetch(`${apiBase}/analytics/${slug}`)
    if (!response.ok) throw new Error('Failed to load analytics')
    analytics.value = await response.json()
  } catch (err) {
    error.value = err.message
  }
}

const loadTimeline = async () => {
  try {
    const response = await fetch(`${apiBase}/analytics/${slug}/timeline?days=${timelineDays.value}`)
    if (!response.ok) throw new Error('Failed to load timeline')
    const data = await response.json()
    timeline.value = data.timeline
  } catch (err) {
    console.error('Failed to load timeline:', err)
  }
}

const getShortUrl = (slug) => {
  return `${apiBase}/s/${slug}`
}

const formatTimelineDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    loadUrlInfo(),
    loadAnalytics(),
    loadTimeline()
  ])
  loading.value = false
})
</script>
