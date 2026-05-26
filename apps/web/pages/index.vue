<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <header class="mb-12">
      <h1 class="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Slashly
      </h1>
      <p class="text-gray-400">URL Shortener Dashboard</p>
    </header>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-dark-card border border-dark-border rounded-lg p-6 hover:border-blue-500/50 transition-colors">
        <div class="text-gray-400 text-sm mb-2">Total URLs</div>
        <div class="text-3xl font-bold">{{ stats.totalUrls }}</div>
      </div>
      <div class="bg-dark-card border border-dark-border rounded-lg p-6 hover:border-purple-500/50 transition-colors">
        <div class="text-gray-400 text-sm mb-2">Total Clicks</div>
        <div class="text-3xl font-bold">{{ stats.totalClicks }}</div>
      </div>
      <div class="bg-dark-card border border-dark-border rounded-lg p-6 hover:border-green-500/50 transition-colors">
        <div class="text-gray-400 text-sm mb-2">Avg Clicks/URL</div>
        <div class="text-3xl font-bold">{{ stats.avgClicks }}</div>
      </div>
    </div>

    <!-- Create URL Section -->
    <div class="bg-dark-card border border-dark-border rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Create Short URL</h2>
      <form @submit.prevent="createShortUrl" class="flex gap-3">
        <input
          v-model="newUrl"
          type="url"
          placeholder="Enter URL to shorten..."
          required
          class="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          :disabled="isCreating"
          class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {{ isCreating ? 'Creating...' : 'Shorten' }}
        </button>
      </form>
      
      <div v-if="createdUrl" class="mt-4 p-4 bg-dark-bg border border-green-500/30 rounded-lg">
        <div class="text-sm text-gray-400 mb-1">Short URL created:</div>
        <div class="flex items-center gap-2">
          <code class="flex-1 text-green-400">{{ createdUrl }}</code>
          <button
            @click="copyToClipboard(createdUrl)"
            class="text-sm bg-dark-card hover:bg-dark-hover border border-dark-border px-3 py-1 rounded transition-colors"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      </div>
    </div>

    <!-- URLs List -->
    <div class="bg-dark-card border border-dark-border rounded-lg p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold">Recent URLs</h2>
        <button
          @click="loadUrls"
          class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading...
      </div>

      <div v-else-if="urls.length === 0" class="text-center py-8 text-gray-400">
        No URLs yet. Create your first short URL above!
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="url in urls"
          :key="url.slug"
          class="bg-dark-bg border border-dark-border rounded-lg p-4 hover:border-blue-500/30 transition-colors"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <code class="text-blue-400 font-mono text-sm">{{ getShortUrl(url.slug) }}</code>
                <button
                  @click="copyToClipboard(getShortUrl(url.slug))"
                  class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div class="text-sm text-gray-400 truncate mb-1">
                {{ url.original_url }}
              </div>
              <div class="text-xs text-gray-500">
                Created {{ formatDate(url.created_at) }}
              </div>
            </div>
            <button
              @click="viewAnalytics(url.slug)"
              class="text-sm bg-dark-card hover:bg-dark-hover border border-dark-border px-4 py-2 rounded transition-colors whitespace-nowrap"
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="urls.length > 0" class="flex justify-between items-center mt-6 pt-6 border-t border-dark-border">
        <button
          @click="previousPage"
          :disabled="offset === 0"
          class="text-sm bg-dark-bg hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed border border-dark-border px-4 py-2 rounded transition-colors"
        >
          Previous
        </button>
        <div class="text-sm text-gray-400">
          Showing {{ offset + 1 }}-{{ Math.min(offset + limit, stats.totalUrls) }} of {{ stats.totalUrls }}
        </div>
        <button
          @click="nextPage"
          :disabled="offset + limit >= stats.totalUrls"
          class="text-sm bg-dark-bg hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed border border-dark-border px-4 py-2 rounded transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const urls = ref([])
const stats = ref({
  totalUrls: 0,
  totalClicks: 0,
  avgClicks: 0
})
const loading = ref(true)
const limit = ref(10)
const offset = ref(0)

const newUrl = ref('')
const createdUrl = ref('')
const isCreating = ref(false)
const copied = ref(false)

const loadUrls = async () => {
  loading.value = true
  try {
    const response = await fetch(`${apiBase}/urls?limit=${limit.value}&offset=${offset.value}`)
    const data = await response.json()
    urls.value = data.urls
    stats.value.totalUrls = data.total
  } catch (error) {
    console.error('Failed to load URLs:', error)
  } finally {
    loading.value = false
  }
}

const createShortUrl = async () => {
  if (!newUrl.value) return
  
  isCreating.value = true
  createdUrl.value = ''
  
  try {
    const response = await fetch(`${apiBase}/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl.value })
    })
    
    const data = await response.json()
    createdUrl.value = data.short_url
    newUrl.value = ''
    
    // Reload URLs to show the new one
    await loadUrls()
  } catch (error) {
    console.error('Failed to create short URL:', error)
    alert('Failed to create short URL')
  } finally {
    isCreating.value = false
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const getShortUrl = (slug) => {
  return `${apiBase}/s/${slug}`
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString()
}

const viewAnalytics = (slug) => {
  navigateTo(`/analytics/${slug}`)
}

const nextPage = () => {
  offset.value += limit.value
  loadUrls()
}

const previousPage = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  loadUrls()
}

onMounted(() => {
  loadUrls()
})
</script>
