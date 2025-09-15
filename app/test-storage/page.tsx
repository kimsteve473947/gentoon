'use client'

import { useState } from 'react'

export default function TestStoragePage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testManualStorage = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/test/manual-storage-test', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    }
    setLoading(false)
  }

  const testRecalculateStorage = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/recalculate-storage', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    }
    setLoading(false)
  }

  const testStorageUsage = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/storage/usage', {
        method: 'GET',
        credentials: 'include'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">스토리지 시스템 테스트</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testManualStorage}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '테스트 중...' : '수동 스토리지 테스트'}
        </button>
        
        <button
          onClick={testRecalculateStorage}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '재계산 중...' : '스토리지 재계산'}
        </button>
        
        <button
          onClick={testStorageUsage}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? '조회 중...' : '스토리지 사용량 조회'}
        </button>
      </div>

      {result && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">테스트 결과:</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}